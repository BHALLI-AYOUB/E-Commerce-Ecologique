package com.phegondev.Phegon.Eccormerce.controller;

import com.phegondev.Phegon.Eccormerce.dto.ProductRecommendation;
import com.phegondev.Phegon.Eccormerce.service.impl.RecommendationService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ProductRecommendation>> getUserRecommendations(
            @PathVariable Long userId,
            @RequestParam(required = false, defaultValue = "5") Integer limit,
            @RequestParam(required = false) String category) {

        return ResponseEntity.ok(
                recommendationService.getRecommendationsForUser(userId, limit, category)
        );
    }

    @GetMapping("/similar/{productId}")
    public ResponseEntity<List<ProductRecommendation>> getSimilarProducts(
            @PathVariable Long productId,
            @RequestParam(required = false, defaultValue = "8") Integer limit) {

        return ResponseEntity.ok(
                recommendationService.getSimilarProducts(productId, limit)
        );
    }

    @PostMapping("/interaction")
    public ResponseEntity<Void> recordInteraction(@RequestBody InteractionRequest request) {
        recommendationService.recordInteraction(
                request.getUserId(),
                request.getProductId(),
                request.getType()
        );
        return ResponseEntity.ok().build();
    }
}

@Data
class InteractionRequest {
    private Long userId;
    private Long productId;
    private String type;
}