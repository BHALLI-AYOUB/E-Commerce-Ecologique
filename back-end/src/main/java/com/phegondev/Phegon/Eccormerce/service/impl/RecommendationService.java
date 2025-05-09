package com.phegondev.Phegon.Eccormerce.service.impl;

import com.phegondev.Phegon.Eccormerce.dto.ProductRecommendation;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RecommendationService {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    /*public RecommendationService(RestTemplate restTemplate, @Value("${recommendation.api.url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }*/

    public RecommendationService(@Qualifier("recommendationRestTemplate") RestTemplate restTemplate,
                                 @Value("${recommendation.api.url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public List<ProductRecommendation> getRecommendationsForUser(Long userId, Integer limit, String category) {
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(baseUrl + "/api/recommendations/" + userId)
                .queryParam("limit", limit);

        if (category != null) {
            builder.queryParam("category", category);
        }

        return Arrays.asList(restTemplate.getForObject(
                builder.toUriString(),
                ProductRecommendation[].class
        ));
    }

    public List<ProductRecommendation> getSimilarProducts(Long productId, Integer limit) {
        return Arrays.asList(restTemplate.getForObject(
                baseUrl + "/api/product-similarity/" + productId + "?limit=" + limit,
                ProductRecommendation[].class
        ));
    }

    public void recordInteraction(Long userId, Long productId, String interactionType) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("productId", productId);
        payload.put("type", interactionType);

        restTemplate.postForEntity(baseUrl + "/api/interactions", payload, Void.class);
    }

}
