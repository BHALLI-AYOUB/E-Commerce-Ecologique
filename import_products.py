import csv
import json
import os
import datetime
import re

# Path to your CSV file
csv_file_path = "E:\\Ecommerce_Apk\\E-Commerce-Ecologique\\amazon_eco-friendly_products.csv"

# Check if file exists
if not os.path.exists(csv_file_path):
    print(f"Error: File not found at {csv_file_path}")
    exit(1)

# Dictionary to store categories by name
categories = {}

# Current timestamp for created_at field
current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Helper function to clean price values
def clean_price(price_str):
    if not price_str:
        return 0.0
    # Remove currency symbol and any commas
    price_clean = re.sub(r'[^\d.]', '', price_str)
    try:
        return float(price_clean)
    except ValueError:
        return 0.0

# Open and read the CSV file
try:
    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        # Try to detect the CSV format
        sample = file.read(4096)
        file.seek(0)
        
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample)
        has_header = sniffer.has_header(sample)
        
        csv_reader = csv.DictReader(file, dialect=dialect)
        
        # Output file
        with open('setup_data.sql', 'w', encoding='utf-8') as sql_file:
            
            # Write SQL transaction start
            sql_file.write("START TRANSACTION;\n\n")
            
            # First, scan for unique categories
            unique_categories = set()
            for row_num, row in enumerate(csv_reader, 1):
                try:
                    # Check if row is valid JSON (some CSVs may store JSON data in cells)
                    product = row
                    
                    # If the row has only one key, it might be a JSON string
                    if len(row) == 1 and list(row.keys())[0].strip().startswith('{'):
                        # Try to parse as JSON
                        product = json.loads(list(row.values())[0])
                    
                    # Extract category name
                    category_name = product.get('category', 'Uncategorized').replace("'", "''")
                    unique_categories.add(category_name)
                    
                except Exception as e:
                    print(f"Error extracting category in row {row_num}: {str(e)}")
            
            # Reset file pointer
            file.seek(0)
            if has_header:
                next(csv_reader)  # Skip header
            
            # Create SQL to handle categories - use INSERT IGNORE to skip duplicates
            sql_file.write("-- First, ensure categories exist (skipping duplicates)\n")
            for category in unique_categories:
                cat_sql = f"INSERT IGNORE INTO `categories`(`created_at`, `name`) VALUES ('{current_time}', '{category}');\n"
                sql_file.write(cat_sql)
            
            # Create a stored procedure that checks if product exists before inserting
            sql_file.write("\n-- Create stored procedure for product insertion\n")
            sql_file.write("""DELIMITER //
CREATE PROCEDURE InsertProductWithCategory(
    IN p_created_at DATETIME,
    IN p_description TEXT,
    IN p_image_url VARCHAR(255),
    IN p_name VARCHAR(255),
    IN p_price DECIMAL(10,2),
    IN p_category_name VARCHAR(255)
)
BEGIN
    DECLARE v_category_id BIGINT;
    
    -- Find the category ID (will work whether it was just inserted or already existed)
    SELECT id INTO v_category_id FROM categories WHERE name = p_category_name LIMIT 1;
    
    -- Insert the product with the found category ID
    INSERT INTO products(
        created_at, 
        description, 
        image_url, 
        name, 
        price, 
        category_id
    ) VALUES (
        p_created_at,
        p_description,
        p_image_url,
        p_name,
        p_price,
        v_category_id
    );
END //
DELIMITER ;
""")
            
            # Reset file pointer for product processing
            file.seek(0)
            csv_reader = csv.DictReader(file, dialect=dialect)
            
            sql_file.write("\n-- Insert products by calling the stored procedure\n")
            
            # Process each row for products
            rows_processed = 0
            for row_num, row in enumerate(csv_reader, 1):
                try:
                    # Check if row is valid JSON
                    product = row
                    
                    # If the row has only one key, it might be a JSON string
                    if len(row) == 1 and list(row.keys())[0].strip().startswith('{'):
                        # Try to parse as JSON
                        product = json.loads(list(row.values())[0])
                    
                    # Extract values safely
                    product_name = product.get('name', '').replace("'", "''")
                    product_description = product.get('description', '').replace("'", "''")
                    product_price = clean_price(product.get('price', '0'))
                    product_image = product.get('img_url', '').replace("'", "''")
                    category_name = product.get('category', 'Uncategorized').replace("'", "''")
                    
                    # Skip if product has no name
                    if not product_name:
                        print(f"Skipping row {row_num}: No product name")
                        continue
                    
                    # Call the stored procedure to insert the product
                    proc_call = f"CALL InsertProductWithCategory('{current_time}', '{product_description}', '{product_image}', '{product_name}', {product_price}, '{category_name}');\n"
                    sql_file.write(proc_call)
                    rows_processed += 1
                    
                except Exception as e:
                    print(f"Error processing product in row {row_num}: {str(e)}")
            
            # Drop the procedure after use
            sql_file.write("\n-- Clean up by dropping the procedure\n")
            sql_file.write("DROP PROCEDURE IF EXISTS InsertProductWithCategory;\n")
            
            # Write SQL transaction commit
            sql_file.write("\nCOMMIT;")
    
    print(f"Successfully processed {rows_processed} products across {len(unique_categories)} categories.")
    print(f"SQL file generated: setup_data.sql")

except Exception as e:
    print(f"Error reading CSV file: {str(e)}")