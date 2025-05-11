from flask import Flask, request, jsonify 
import pickle
import numpy as np
import pymysql
from flask_cors import CORS
import torch
from sentence_transformers import SentenceTransformer
import logging
import os
import traceback

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Modifié pour accepter toutes les routes

# Configuration pour MySQL
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'db': 'ecommerce-db',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

MODEL_PATH = r'C:\Users\HP\Downloads\E-Commerce-Ecologique\sentence_transformer_model.pkl'
DEFAULT_EMBEDDING_DIM = 384
# Créer le modèle par défaut si nécessaire
if not os.path.exists(MODEL_PATH):
    try:
        logger.info("Modèle non trouvé, création d'un modèle par défaut...")
        default_model = SentenceTransformer('all-MiniLM-L6-v2')
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(default_model, f)
        logger.info(f"Modèle par défaut créé à {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Impossible de créer un modèle par défaut: {e}")

# Initialisation du modèle
try:
    # Chargement du modèle
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    logger.info("Modèle chargé avec succès!")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    
    # Déterminer la dimension des embeddings
    test_text = "Test embedding dimension"
    embedding = model.encode([test_text])[0]
    embedding_dim = embedding.shape[0]
    logger.info(f"Dimension des embeddings: {embedding_dim}")
    
except Exception as e:
    logger.error(f"Erreur lors du chargement du modèle: {e}")
    model = None
    embedding_dim = DEFAULT_EMBEDDING_DIM

# Fonctions d'accès à la base de données
def get_connection():
    """Établit une connexion à la base de données MySQL"""
    try:
        return pymysql.connect(**DB_CONFIG)
    except Exception as e:
        logger.error(f"Erreur de connexion à la base de données: {e}")
        raise

def init_db():
    """Initialise les tables nécessaires dans la base de données"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Vérifier d'abord que la structure des tables products et users est correcte
            cursor.execute("SHOW KEYS FROM `products` WHERE Key_name = 'PRIMARY'")
            product_pk = cursor.fetchone()
            
            if not product_pk:
                logger.error("La table products n'a pas de clé primaire!")
                return
                
            # Créer la table d'embeddings sans contrainte de clé étrangère pour l'instant
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS `product_embeddings` (
                `product_id` INT PRIMARY KEY,
                `embedding` BLOB NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            ''')
            
            # Créer la table d'interactions sans contrainte de clé étrangère pour l'instant
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS `user_interactions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `product_id` INT NOT NULL,
                `interaction_type` VARCHAR(50) NOT NULL,
                `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
        conn.commit()
        logger.info("Tables de recommandation initialisées avec succès")
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation des tables: {e}")
        logger.error(traceback.format_exc())
    finally:
        conn.close()

def get_product_info(product_id=None):
    """Récupère les informations des produits depuis la base de données"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if product_id:
                # Récupérer un produit spécifique avec sa catégorie
                cursor.execute('''
                SELECT p.`id`, p.`name`, p.`description`, p.`image_url`, p.`price`, c.`name` as category 
                FROM `products` p
                LEFT JOIN `categories` c ON p.`category_id` = c.`id`
                WHERE p.`id` = %s
                ''', (product_id,))
                return cursor.fetchone()
            else:
                # Récupérer tous les produits avec leurs catégories
                cursor.execute('''
                SELECT p.`id`, p.`name`, p.`description`, p.`image_url`, p.`price`, c.`name` as category 
                FROM `products` p
                LEFT JOIN `categories` c ON p.`category_id` = c.`id`
                ''')
                return cursor.fetchall()
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des produits: {e}")
        return []
    finally:
        conn.close()

def store_embedding(product_id, embedding):
    """Stocke l'embedding d'un produit dans la base de données"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
            INSERT INTO `product_embeddings` (`product_id`, `embedding`)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE `embedding` = %s
            ''', (product_id, embedding.tobytes(), embedding.tobytes()))
        conn.commit()
    except Exception as e:
        logger.error(f"Erreur lors du stockage de l'embedding pour le produit {product_id}: {e}")
    finally:
        conn.close()

def get_all_product_embeddings():
    """Récupère tous les embeddings de produits de la base de données"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
            SELECT p.`id`, p.`name`, p.`description`, p.`image_url`, p.`price`, c.`name` as category, pe.`embedding`
            FROM `products` p
            LEFT JOIN `categories` c ON p.`category_id` = c.`id`
            JOIN `product_embeddings` pe ON p.`id` = pe.`product_id`
            ''')
            results = cursor.fetchall()
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des embeddings: {e}")
        return [], [], np.array([])
    finally:
        conn.close()
    
    if not results:
        return [], [], np.array([])
    
    product_ids = []
    product_info = []
    embeddings = []
    
    for row in results:
        product_ids.append(row['id'])
        product_info.append({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'image_url': row['image_url'],
            'price': row['price'],
            'category': row['category']
        })
        
        # Convertir les bytes en tableau numpy
        embedding = np.frombuffer(row['embedding'], dtype=np.float32)
        embeddings.append(embedding)
    
    if embeddings:
        embeddings_array = np.stack(embeddings)
        return product_ids, product_info, embeddings_array
    else:
        return [], [], np.array([])

def store_user_interaction(user_id, product_id, interaction_type):
    """Stocke une interaction utilisateur-produit dans la base de données"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
            INSERT INTO `user_interactions` (`user_id`, `product_id`, `interaction_type`)
            VALUES (%s, %s, %s)
            ''', (user_id, product_id, interaction_type))
        conn.commit()
    except Exception as e:
        logger.error(f"Erreur lors du stockage de l'interaction: {e}")
    finally:
        conn.close()

def get_user_history(user_id, limit=5):
    """Récupère l'historique récent de l'utilisateur basé sur les commandes et les avis"""
    conn = get_connection()
    history = []
    
    try:
        with conn.cursor() as cursor:
            # Commandes récentes
            cursor.execute('''
            SELECT p.`name`, p.`description`, c.`name` as category
            FROM `order_items` oi
            JOIN `products` p ON oi.`product_id` = p.`id`
            LEFT JOIN `categories` c ON p.`category_id` = c.`id`
            WHERE oi.`user_id` = %s
            ORDER BY oi.`created_at` DESC
            LIMIT %s
            ''', (user_id, limit))
            order_history = cursor.fetchall()
            history.extend(order_history)
            
            # Avis récents
            cursor.execute('''
            SELECT p.`name`, p.`description`, c.`name` as category, r.`rating`
            FROM `reviews` r
            JOIN `products` p ON r.`product_id` = p.`id`
            LEFT JOIN `categories` c ON p.`category_id` = c.`id`
            WHERE r.`user_id` = %s
            ORDER BY r.`created_at` DESC
            LIMIT %s
            ''', (user_id, limit))
            review_history = cursor.fetchall()
            history.extend(review_history)
            
            # Interactions explicites stockées
            cursor.execute('''
            SELECT p.`name`, p.`description`, c.`name` as category
            FROM `user_interactions` ui
            JOIN `products` p ON ui.`product_id` = p.`id`
            LEFT JOIN `categories` c ON p.`category_id` = c.`id`
            WHERE ui.`user_id` = %s
            ORDER BY ui.`timestamp` DESC
            LIMIT %s
            ''', (user_id, limit))
            interaction_history = cursor.fetchall()
            history.extend(interaction_history)
    
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de l'historique utilisateur: {e}")
    finally:
        conn.close()
    
    # Limiter le nombre total de résultats
    return history[:limit]

# Initialiser les tables supplémentaires au démarrage
try:
    init_db()
except Exception as e:
    logger.error(f"Erreur critique lors de l'initialisation de la base de données: {e}")

# Routes API - ASSUREZ-VOUS QUE TOUTES SONT BIEN DÉFINIES ICI
@app.route('/', methods=['GET'])
def home():
    """Page d'accueil simple"""
    return jsonify({
        "message": "Service de recommandation actif", 
        "endpoints": [
            "/health",
            "/api/generate-embeddings",
            "/api/recommendations/<user_id>",
            "/api/interactions",
            "/api/encode",
            "/api/product-similarity/<product_id>"
        ]
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de vérification de l'état de santé du service"""
    return jsonify({
        "status": "healthy", 
        "model_loaded": model is not None,
        "embedding_dimension": embedding_dim if model is not None else None
    })

@app.route('/api/generate-embeddings', methods=['GET'])
def generate_all_embeddings():
    """Endpoint pour générer les embeddings pour tous les produits en base"""
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
    
    try:
        # Récupérer tous les produits
        products = get_product_info()
        processed = 0
        
        for product in products:
            # Concaténer le nom, la description et la catégorie pour l'embedding
            text = f"{product['name']} {product['description']} {product['category']}"
            embedding = model.encode([text])[0]
            
            # Stocker l'embedding
            store_embedding(product['id'], embedding)
            processed += 1
        
        return jsonify({
            "status": "success", 
            "message": f"Embeddings générés pour {processed} produits"
        })
    
    except Exception as e:
        logger.error(f"Erreur lors de la génération des embeddings: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recommendations/<int:user_id>', methods=['GET'])
def get_recommendations(user_id):
    """Endpoint pour obtenir des recommandations pour un utilisateur donné"""
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
    
    try:
        limit = request.args.get('limit', default=5, type=int)
        category = request.args.get('category', default=None)
        
        # Obtenir l'historique récent de l'utilisateur
        user_history = get_user_history(user_id)
        
        if user_history:
            # Construire une requête basée sur l'historique utilisateur
            history_text = " ".join([f"{row['name']} {row['description']} {row['category']}" for row in user_history])
            # Si nous avons des avis avec des notes, donner plus de poids aux produits bien notés
            for item in user_history:
                if 'rating' in item and item['rating'] is not None and item['rating'] >= 4:
                    history_text += f" {item['name']} {item['description']} {item['category']}"
            
            query = f"User {user_id} interested in {history_text}"
        else:
            # Requête générique si pas d'historique
            query = f"User {user_id} recommendation"
            if category:
                query += f" for {category}"
        
        # Obtenir l'embedding de la requête
        query_embedding = model.encode([query])[0]
        
        # Récupérer tous les embeddings de produits
        product_ids, product_info, product_embeddings = get_all_product_embeddings()
        
        if len(product_embeddings) == 0:
            # Pas d'embeddings en base, retourner message d'erreur
            return jsonify({"error": "Aucun embedding de produit disponible. Exécutez d'abord /api/generate-embeddings"}), 404
        
        # Filtrer par catégorie si spécifié
        if category:
            filtered_indices = [i for i, prod in enumerate(product_info) if prod['category'] == category]
            if filtered_indices:
                product_ids = [product_ids[i] for i in filtered_indices]
                product_info = [product_info[i] for i in filtered_indices]
                product_embeddings = product_embeddings[filtered_indices]
            else:
                return jsonify([])  # Aucun produit ne correspond à cette catégorie
        
        # Calculer les similarités
        similarities = np.dot(product_embeddings, query_embedding)
        top_k_indices = np.argsort(similarities)[-limit:][::-1]
        
        recommendations = [
            {
                "itemId": int(product_ids[i]),
                "itemName": product_info[i]['name'],
                "itemDescription": product_info[i]['description'],
                "itemImage": product_info[i]['image_url'],
                "itemCategory": product_info[i]['category'],
                "itemPrice": float(product_info[i]['price']),
                "score": float(similarities[i])
            }
            for i in top_k_indices
        ]
        
        return jsonify(recommendations)
    
    except Exception as e:
        logger.error(f"Erreur lors de la génération des recommandations: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/interactions', methods=['POST'])
def record_interaction():
    """Endpoint pour enregistrer une interaction utilisateur-produit"""
    if not request.json:
        return jsonify({"error": "Données JSON requises"}), 400
    
    try:
        data = request.json
        if 'userId' not in data or 'productId' not in data or 'type' not in data:
            return jsonify({"error": "userId, productId et type requis"}), 400
        
        store_user_interaction(data['userId'], data['productId'], data['type'])
        return jsonify({"status": "success"})
    
    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement de l'interaction: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/encode', methods=['POST'])
def encode_text():
    """Endpoint pour encoder du texte avec le modèle"""
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
    
    if not request.json or 'text' not in request.json:
        return jsonify({"error": "Texte requis dans le corps JSON"}), 400
    
    try:
        text = request.json['text']
        embedding = model.encode([text])[0].tolist()
        return jsonify({"embedding": embedding})
    
    except Exception as e:
        logger.error(f"Erreur lors de l'encodage du texte: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/product-similarity/<int:product_id>', methods=['GET'])
def get_similar_products(product_id):
    """Endpoint pour obtenir des produits similaires à un produit donné"""
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
    
    try:
        limit = request.args.get('limit', default=5, type=int)
        
        # Récupérer les informations du produit
        product = get_product_info(product_id)
        if not product:
            return jsonify({"error": f"Produit avec ID {product_id} non trouvé"}), 404
        
        # Récupérer l'embedding du produit depuis la base ou le générer
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute('SELECT `embedding` FROM `product_embeddings` WHERE `product_id` = %s', (product_id,))
                result = cursor.fetchone()
        finally:
            conn.close()
        
        if result and 'embedding' in result:
            # Utiliser l'embedding stocké
            product_embedding = np.frombuffer(result['embedding'], dtype=np.float32)
        else:
            # Générer un nouvel embedding
            text = f"{product['name']} {product['description']} {product['category']}"
            product_embedding = model.encode([text])[0]
            # Stocker pour usage futur
            store_embedding(product_id, product_embedding)
        
        # Récupérer tous les embeddings de produits
        all_product_ids, all_product_info, all_product_embeddings = get_all_product_embeddings()
        
        if len(all_product_embeddings) == 0:
            return jsonify({"error": "Aucun embedding de produit disponible"}), 404
        
        # Calculer les similarités
        similarities = np.dot(all_product_embeddings, product_embedding)
        
        # Exclure le produit lui-même
        product_idx = all_product_ids.index(product_id) if product_id in all_product_ids else -1
        if product_idx >= 0:
            similarities[product_idx] = -1  # Pour s'assurer qu'il n'est pas dans les résultats
        
        top_k_indices = np.argsort(similarities)[-limit:][::-1]
        
        similar_products = [
            {
                "itemId": int(all_product_ids[i]),
                "itemName": all_product_info[i]['name'],
                "itemDescription": all_product_info[i]['description'],
                "itemImage": all_product_info[i]['image_url'],
                "itemCategory": all_product_info[i]['category'],
                "itemPrice": float(all_product_info[i]['price']),
                "similarity": float(similarities[i])
            }
            for i in top_k_indices
        ]
        
        return jsonify(similar_products)
    
    except Exception as e:
        logger.error(f"Erreur lors de la recherche de produits similaires: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)