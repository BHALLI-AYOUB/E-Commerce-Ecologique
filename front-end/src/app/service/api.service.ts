import { EventEmitter, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// Interface pour définir le type d'utilisateur
interface User {
  id ?: any;
  user : any ;
  [key: string]: any; // Permet d'autres propriétés
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  authStatuschanged = new EventEmitter<void>();
  private static BASE_URL = 'http://localhost:2424';


  constructor(private http: HttpClient) { }


  private getHeader():HttpHeaders{
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  /**
   * Récupère l'utilisateur actuellement connecté 
   * Méthode spécifique pour les recommandations
   */
  getCurrentUser(): Observable<User> {
    // Utiliser le même endpoint que getLoggedInUserInfo mais avec des paramètres pour éviter le cache
    const timestamp = Date.now();
    return this.http.get<User>(`${ApiService.BASE_URL}/user/my-info?_t=${timestamp}`, {
      headers: this.getHeader()
    }).pipe(
      tap((user: User) => {
        if (user && typeof user.id === 'number') {
          // Stocker l'ID dans localStorage et sessionStorage
          localStorage.setItem('userId', user.id.toString());
          sessionStorage.setItem('userId', user.id.toString());
          console.log('Current user set from API:', user.id);
        }
      }),
      catchError(err => {
        console.error('Error fetching current user:', err);
        // Essayer d'utiliser l'ID stocké localement
        const userId = localStorage.getItem('userId');
        if (userId) {
          console.log('Using cached user ID:', userId);
          return of({ id: Number(userId) } as User);
        }
        // Sinon, retourner un utilisateur avec ID=1 pour le développement
        if (window.location.hostname === 'localhost') {
          console.log('Using default development user ID: 1');
          return of({ id: 1 } as User);
        }
        return of({} as User);
      })
    );
  }

  /***AUTH & USERS API METHODS */

  registerUser(registration: any): Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/auth/register`, registration);
  }

  loginUser(loginDetails: any): Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/auth/login`, loginDetails);
  }

  getLoggedInUserInfo(): Observable<User> {
    return this.http.get<User>(`${ApiService.BASE_URL}/user/my-info`, {
      headers: this.getHeader()
    }).pipe(
      tap((user: User) => {
        if (user.user?.id != 'undefined') {
          // Stocker l'ID en cas de succès pour les futures requêtes
          localStorage.setItem('userId', user.user.id.toString());
        }
      })
    );
  }

  /***PRODUCTS API */
  addProduct(formData: any): Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/product/create`, formData, {
      headers: this.getHeader()
    });
  }

  updateProduct(formData: any): Observable<any>{
    return this.http.put(`${ApiService.BASE_URL}/product/update`, formData, {
      headers: this.getHeader()
    });
  }

  getAllProducts(): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/product/get-all`);
  }


  searchProducts(searchValue: string): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/product/search`, {
      params: {searchValue}
    });
  }

  getAllProductsByCategotyId(categoryId: string): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/product/get-by-category-id/${categoryId}`);
  }

  getProductById(productId: string): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/product/get-by-product-id/${productId}`);
  }


  deletProduct(productId: string): Observable<any>{
    return this.http.delete(`${ApiService.BASE_URL}/product/delete/${productId}`, {
      headers: this.getHeader()
    });
  }

  /**CATEGOTY API */
  createCategory(body: any):Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/category/create`, body, {
      headers: this.getHeader()
    });
  }

  getAllCategory():Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/category/get-all`);
  }

  getCategoryById(categoryId: string):Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/category/get-category-by-id/${categoryId}`);
  }

  updateCategory(categoryId: string, body: any):Observable<any>{
    return this.http.put(`${ApiService.BASE_URL}/category/update/${categoryId}`, body, {
      headers: this.getHeader()
    });
  }

  deleteCategory(categoryId: string):Observable<any>{
    return this.http.delete(`${ApiService.BASE_URL}/category/delete/${categoryId}`, {
      headers: this.getHeader()
    });
  }

  /**ORDER API */
  createOrder(body: any): Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/order/create`, body, {
      headers: this.getHeader()
    });
  }

  getAllOrders(): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/order/filter`, {
      headers: this.getHeader()
    });
  }

  getOrderItemById(itemId: string): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/order/filter`, {
      headers: this.getHeader(),
      params: {itemId}
    });
  }

  getAllOrderItemsByStatus(status: string): Observable<any>{
    return this.http.get(`${ApiService.BASE_URL}/order/filter`, {
      headers: this.getHeader(),
      params: {status}
    });
  }


  updateOrderItemStatus(orderItemId: string, status: string): Observable<any>{
    return this.http.put(`${ApiService.BASE_URL}/order/update-item-status/${orderItemId}`, {}, {
      headers: this.getHeader(),
      params: {status}
    });
  }

  /**ADDRESS  */
  saveAddress(body: any):Observable<any>{
    return this.http.post(`${ApiService.BASE_URL}/address/save`, body, {
      headers: this.getHeader()
    });
  }

  /**AUTHENTICATION */
  logout():void{
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    sessionStorage.removeItem('userId');
    this.authStatuschanged.emit();
  }

  isAuthenticated():boolean{
    const token = localStorage.getItem('token');
    return !!token;
  }

  isAdmin():boolean {
    const role = localStorage.getItem('role');
    return role === 'ADMIN';
  }

  /**
   * Force l'obtention d'un nouvel ID utilisateur pour les tests
   * Utile uniquement en développement
   */
  setTestUser(userId: number): void {
    if (window.location.hostname === 'localhost') {
      localStorage.setItem('userId', userId.toString());
      sessionStorage.setItem('userId', userId.toString());
      console.log(`Test user ID set to: ${userId}`);
    }
  }
}