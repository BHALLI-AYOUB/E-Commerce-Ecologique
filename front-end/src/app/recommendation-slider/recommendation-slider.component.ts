import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RecommendationService } from '../service/recommendation.service';
import { ApiService } from '../service/api.service';

@Component({
  selector: 'app-recommendation-slider',
  templateUrl: './recommendation-slider.component.html',
  styleUrls: ['./recommendation-slider.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class RecommendationSliderComponent implements OnInit, OnChanges {
  @Input() userId: number | null = null;
  @Input() timestamp: number = Date.now(); // Valeur par défaut
  
  recommendations: any[] = [];
  loading = true;
  error = false;
  errorMessage = '';
  productsToShow = 25;
  retryCount = 0;
  maxRetries = 2;
  currentUserId: number | null = null;
  
  // Pour le déboggage
  lastApiCall: string = '';

  constructor(
    private recommendationService: RecommendationService,
    private apiService: ApiService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Attendre que l'application soit complètement chargée
    setTimeout(() => {
      // Obtenir l'utilisateur actuel du backend
      this.getCurrentUserFromBackend();
    }, 200);
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId']) {
      console.log('User ID changed via @Input:', changes['userId'].currentValue);
      // Nettoyer les recommandations existantes pour éviter de voir les anciennes
      this.recommendations = [];
      this.getCurrentUserFromBackend();
    }
  }
  
  private getCurrentUserFromBackend(): void {
    this.loading = true;
    
    // Essayer d'abord d'obtenir l'utilisateur du backend
    this.apiService.getCurrentUser().subscribe({
      next: (user) => {
        if (user && user.id) {
          this.currentUserId = user.id;
          console.log('User ID obtained from backend API:', this.currentUserId);
          this.loadRecommendations();
        } else {
          // Si aucun utilisateur n'est retourné par l'API, utiliser d'autres méthodes
          this.fallbackGetUserId();
        }
      },
      error: () => {
        // En cas d'erreur, utiliser d'autres méthodes
        this.fallbackGetUserId();
      }
    });
  }
  
  private fallbackGetUserId(): void {
    // Utiliser d'autres méthodes pour obtenir l'ID utilisateur
    this.currentUserId = this.getUserId();
    console.log('User ID obtained from fallback methods:', this.currentUserId);
    
    if (this.currentUserId) {
      this.loadRecommendations();
    } else {
      this.error = true;
      this.loading = false;
      this.errorMessage = 'Impossible d\'identifier l\'utilisateur';
    }
  }

  loadRecommendations(): void {
    this.loading = true;
    this.error = false;
    this.errorMessage = '';
    this.retryCount = 0;
    
    if (!this.currentUserId) {
      console.error('No valid user ID found for recommendations');
      this.error = true;
      this.loading = false;
      this.errorMessage = 'Aucun ID utilisateur valide';
      return;
    }
    
    // Enregistrer l'appel d'API pour le déboggage
    this.lastApiCall = `${this.baseUrl}/user/${this.currentUserId}?limit=${this.productsToShow}&_t=${Date.now()}`;
    
    this.fetchRecommendations(this.currentUserId);
  }

  private fetchRecommendations(userId: number): void {
    console.log(`COMPONENT: Fetching recommendations for user ${userId} at ${new Date().toISOString()}`);
    
    this.recommendationService.getUserRecommendations(userId, this.productsToShow)
      .subscribe({
        next: (data: any[]) => {
          if (data && data.length > 0) {
            this.recommendations = data;
            this.loading = false;
            this.error = false;
            
            // Ajouter des informations de débogage
            console.log(`SUCCESS: Loaded ${data.length} recommendations for user ${userId}`, 
                       data.map(item => `${item.itemId} (${item.itemName})`));
          } else {
            console.warn(`WARNING: No recommendations received for user ${userId}`);
            if (this.retryCount < this.maxRetries) {
              this.retryCount++;
              console.log(`Retrying (${this.retryCount}/${this.maxRetries})...`);
              setTimeout(() => this.fetchRecommendations(userId), 1000);
            } else {
              this.error = true;
              this.loading = false;
              this.errorMessage = 'Aucune recommandation trouvée pour cet utilisateur';
            }
          }
        },
        error: (err: any) => {
          console.error(`ERROR: Failed to load recommendations for user ${userId}:`, err);
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`Retrying (${this.retryCount}/${this.maxRetries})...`);
            setTimeout(() => this.fetchRecommendations(userId), 1000);
          } else {
            this.error = true;
            this.loading = false;
            this.errorMessage = err.message || 'Impossible de charger les recommandations. Veuillez réessayer plus tard.';
          }
        }
      });
  }
  
  // Fallback pour obtenir l'ID utilisateur
  private getUserId(): number | null {
    // Priorité 1: L'ID passé en @Input
    if (this.userId && this.userId > 0) {
      console.log('Using userId from @Input:', this.userId);
      return this.userId;
    }
    
    // Priorité 2: localStorage (si authentifié)
    if (this.apiService.isAuthenticated()) {
      const userId = localStorage.getItem('userId');
      if (userId && !isNaN(Number(userId)) && Number(userId) > 0) {
        console.log('Using userId from localStorage:', userId);
        return Number(userId);
      }
    }
    
    // Priorité 3: sessionStorage
    const sessionUserId = sessionStorage.getItem('userId');
    if (sessionUserId && !isNaN(Number(sessionUserId)) && Number(sessionUserId) > 0) {
      console.log('Using userId from sessionStorage:', sessionUserId);
      return Number(sessionUserId);
    }
    
    // Priorité 4: URL actuelle (si elle contient un ID utilisateur)
    const urlMatch = window.location.href.match(/user\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      const urlUserId = Number(urlMatch[1]);
      console.log('Using userId from URL:', urlUserId);
      return urlUserId;
    }
    
    // Dernier recours: utilisateur par défaut pour le développement
    console.log('Using default userId 1 as fallback');
    return 1;
  }

  goToProductDetailsPage(productId: number): void {
    const userId = this.currentUserId || this.getUserId();
    
    if (userId) {
      this.recommendationService.recordInteraction(userId, productId, 'view')
        .subscribe({
          error: (err: any) => console.error('Failed to record view interaction', err)
        });
    }
      
    this.router.navigate(['/product', productId]);
  }

  showAllProducts(): void {
    this.router.navigate(['/products'], { queryParams: { recommended: true } });
  }

  addToCart(product: any): void {
    console.log('Added to cart:', product);
    
    const userId = this.currentUserId || this.getUserId();
    if (userId) {
      this.recommendationService.recordInteraction(userId, product.itemId, 'add_to_cart')
        .subscribe({
          error: (err: any) => console.error('Failed to record cart interaction', err)
        });
    }
    
    // Implémentation de la logique du panier ici...
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value);
  }
  
  scrollLeft(): void {
    const container = document.querySelector('.product-cards') as HTMLElement;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  scrollRight(): void {
    const container = document.querySelector('.product-cards') as HTMLElement;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }
  
  // Méthode publique pour forcer le rechargement des recommandations
  retry(): void {
    this.getCurrentUserFromBackend();
  }
  
  // Pour le débogage - obtenir l'URL complète
  get baseUrl(): string {
    return 'http://localhost:2424/recommendations';
  }
}