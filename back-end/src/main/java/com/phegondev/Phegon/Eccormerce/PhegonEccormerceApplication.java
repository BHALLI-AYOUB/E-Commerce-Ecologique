package com.phegondev.Phegon.Eccormerce;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
public class PhegonEccormerceApplication {

	public static void main(String[] args) {
		SpringApplication.run(PhegonEccormerceApplication.class, args);
	}

	@Bean(name = "recommendationRestTemplate")
	public RestTemplate recommendationRestTemplate() {
		return new RestTemplate();
	}

}
