import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap, retry, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private baseUrl = 'http://localhost:2424/recommendations';
  
  // Variable pour le mode développement - plus facile à activer/désactiver
  private devMode = false;
  
  constructor(private http: HttpClient) { }

  getUserRecommendations(userId: number, limit: number = 8): Observable<any[]> {
    console.log(`Fetching recommendations for user ID: ${userId} (timestamp: ${Date.now()})`);
    
    // Ajouter des paramètres pour éviter le cache
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('_t', Date.now().toString()); // Timestamp pour éviter le cache
    
    // Ajouter des en-têtes pour éviter le cache
    const headers = new HttpHeaders()
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0');
    
    return this.http.get<any[]>(`${this.baseUrl}/user/${userId}`, { params, headers })
      .pipe(
        retry(1),
        map(results => {
          // Si en mode dev, ajouter l'ID utilisateur à chaque élément pour le débogage
          if (this.devMode) {
            return results.map(item => ({
              ...item,
              _debug_userId: userId // Champ pour vérification lors du débogage
            }));
          }
          return results;
        }),
        tap(results => {
          console.log(`Received ${results.length} recommendations for user ${userId}:`, 
                     results.map(r => r.itemId));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching recommendations for user ${userId}:`, error);
          
          if (error.status === 404) {
            console.warn('Endpoint not found, returning empty array');
            return of([]);
          }
          
          throw error;
        })
      );
  }

  recordInteraction(userId: number, productId: number, type: string): Observable<void> {
    console.log(`Recording interaction for user ${userId}, product ${productId}, type: ${type}`);
    
    return this.http.post<void>(`${this.baseUrl}/interaction`, {
      userId,
      productId,
      type,
      timestamp: Date.now() // Ajouter un timestamp
    }).pipe(
      catchError(error => {
        console.error('Error recording interaction:', error);
        return of(void 0);
      })
    );
  }
  
  // Méthode pour tester avec différents utilisateurs en mode développement
  switchToTestUser(userId: number): void {
    if (this.devMode) {
      localStorage.setItem('testUserId', userId.toString());
      console.log(`Switched to test user ID: ${userId}`);
    }
  }
  
  getTestUserId(): number | null {
    if (this.devMode) {
      const testId = localStorage.getItem('testUserId');
      return testId ? Number(testId) : null;
    }
    return null;
  }
}