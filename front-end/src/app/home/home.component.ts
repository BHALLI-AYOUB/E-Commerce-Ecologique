import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiService } from '../service/api.service';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';

// Import components
import { PaginationComponent } from '../pagination/pagination.component';
import { ProductlistComponent } from '../productlist/productlist.component';
import { RecommendationSliderComponent } from '../recommendation-slider/recommendation-slider.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    PaginationComponent, 
    ProductlistComponent, 
    RecommendationSliderComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  isAuthenticated = false;
  userId: number | null = null;
  products: any[] = [];
  currentPage = 1;
  totalPages = 0;
  itemsPerPage = 20;
  error: any = null;
  loadingUser = true;
  userError = false;

  // Pour le débogage des recommandations
  currentTimestamp = Date.now();
  debugMode = false;

  constructor(private apiService: ApiService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    // Initialiser avec un timestamp pour invalider le cache
    this.currentTimestamp = Date.now();
    
    // Vérifier l'état d'authentification
    this.isAuthenticated = this.apiService.isAuthenticated();
    
    // Récupérer l'ID utilisateur (avec priorité accrue)
    this.loadUserInfo();

    // Récupérer les paramètres de requête pour les produits
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      const searchItem = params.get('search');
      const pageParam = params.get('page');
      this.currentPage = pageParam ? +pageParam : 1;
      this.fetchProducts(searchItem);
    });
    
    // Activer le mode débogage en environnement de développement
    if (window.location.hostname === 'localhost') {
      this.debugMode = true;
    }
  }

  /**
   * Récupère les informations de l'utilisateur depuis l'API
   * avec gestion d'erreur améliorée et tentatives multiples
   */
  loadUserInfo(): void {
    this.loadingUser = true;
    this.userError = false;
    
    console.log('Loading user info...');
    
    this.apiService.getLoggedInUserInfo()
      .pipe(
        tap(userInfo => {
          if (userInfo && userInfo.id) {
            // L'ID utilisateur est valide
            console.log('User info loaded successfully:', userInfo.id);
            this.userId = userInfo.id;
            
            // Stocker l'ID dans différents emplacements pour assurer la cohérence
            localStorage.setItem('userId', userInfo.id.toString());
            sessionStorage.setItem('userId', userInfo.id.toString());
            
            // Forcer le rafraîchissement du timestamp pour invalider tout cache
            this.currentTimestamp = Date.now();
          } else {
            console.warn('User info missing ID property');
            this.tryFallbackUserId();
          }
        }),
        catchError(error => {
          console.error('Error loading user info:', error);
          this.userError = true;
          this.tryFallbackUserId();
          return of(null);
        }),
        finalize(() => {
          this.loadingUser = false;
        })
      )
      .subscribe();
  }

  /**
   * Tente de récupérer l'ID utilisateur à partir d'autres sources
   * si l'API a échoué
   */
  tryFallbackUserId(): void {
    console.log('Trying fallback user ID sources...');
    
    // Essayer de récupérer depuis localStorage
    const storedId = localStorage.getItem('userId');
    if (storedId && !isNaN(Number(storedId)) && Number(storedId) > 0) {
      console.log('Using userId from localStorage:', storedId);
      this.userId = Number(storedId);
      return;
    }
    
    // Essayer de récupérer depuis l'URL
    const urlMatch = window.location.href.match(/user\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      const urlUserId = Number(urlMatch[1]);
      console.log('Using userId from URL:', urlUserId);
      this.userId = urlUserId;
      return;
    }
    
    // Définir un ID par défaut pour le développement
    if (window.location.hostname === 'localhost') {
      console.log('Using default userId 1 for development');
      this.userId = 1;
    } else {
      // En production, ne pas utiliser d'ID par défaut
      this.userId = null;
    }
  }

  /**
   * Récupère les produits depuis l'API
   */
  fetchProducts(searchItem: string | null): void {
    const productObservable = searchItem 
      ? this.apiService.searchProducts(searchItem)
      : this.apiService.getAllProducts();

    productObservable.subscribe({
      next: (response) => {
        if (response?.productList && response.productList.length > 0) {
          this.handleProductResponse(response.productList);
        } else {
          this.error = 'Product Not Found';
        }
      },
      error: (error) => {
        console.error('Error fetching products:', error);
        this.error = error?.error?.message || "error getting products";
      }
    });
  }

  /**
   * Traite les données de produits reçues de l'API
   */
  handleProductResponse(products: []): void {
    this.totalPages = Math.ceil(products.length / this.itemsPerPage);
    this.products = products.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
    console.log('Products loaded:', this.products.length);
  }

  /**
   * Change la page de résultats
   */
  changePage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Force le rechargement de l'utilisateur et des recommandations
   * (utile pour les tests et le débogage)
   */
  reloadUserAndRecommendations(): void {
    this.loadUserInfo();
    this.currentTimestamp = Date.now();
  }
  
  /**
   * Change temporairement l'ID utilisateur pour tester les recommandations
   * (uniquement en mode développement)
   */
  changeTestUser(newUserId: number): void {
    if (this.debugMode) {
      console.log(`Switching to test user ID: ${newUserId}`);
      this.userId = newUserId;
      localStorage.setItem('userId', newUserId.toString());
      sessionStorage.setItem('userId', newUserId.toString());
      this.currentTimestamp = Date.now();
    }
  }
}