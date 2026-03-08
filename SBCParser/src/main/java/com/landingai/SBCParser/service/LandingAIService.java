package com.landingai.SBCParser.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@Service
public class LandingAIService {

    @Value("${landingai.api.key}")
    private String apiKey;

    @Value("${landingai.api.url.parse}")
    private String parseUrl;

    @Value("${landingai.api.url.extract}")
    private String extractUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String parseDocument(MultipartFile file) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("Authorization", apiKey.startsWith("Basic ") || apiKey.startsWith("Bearer ") ? apiKey : "Basic " + apiKey); 

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("document", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            }
        });

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(parseUrl, requestEntity, String.class);
        return response.getBody();
    }

    public String extractData(String schema, String markdown) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("Authorization", apiKey.startsWith("Basic ") || apiKey.startsWith("Bearer ") ? apiKey : "Basic " + apiKey); 

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("schema", schema);
        
        // Add markdown as a file
        body.add("markdown", new ByteArrayResource(markdown.getBytes()) {
            @Override
            public String getFilename() {
                return "document.md";
            }
        });

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(extractUrl, requestEntity, String.class);
        return response.getBody();
    }
}
