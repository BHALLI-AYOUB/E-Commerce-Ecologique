package com.phegondev.Phegon.Eccormerce.dto;

import lombok.Data;

@Data
public class ProductRecommendation {
    private Long itemId;
    private String itemName;
    private String itemDescription;
    private String itemImage;
    private String itemCategory;
    private Double itemPrice;
    private Double score;  // or similarity for similar products endpoint
}
