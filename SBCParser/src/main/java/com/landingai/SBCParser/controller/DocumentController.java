package com.landingai.SBCParser.controller;

import com.landingai.SBCParser.service.LandingAIService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DocumentController {

    private final LandingAIService landingAIService;

    public DocumentController(LandingAIService landingAIService) {
        this.landingAIService = landingAIService;
    }

    @PostMapping("/parse")
    public ResponseEntity<String> parseDocument(@RequestParam("document") MultipartFile document) {
        try {
            String result = landingAIService.parseDocument(document);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error parsing document: " + e.getMessage());
        }
    }

    @PostMapping("/extract")
    public ResponseEntity<String> extractData(
            @RequestParam("schema") String schema,
            @RequestParam("markdown") String markdown) {
        try {
            String result = landingAIService.extractData(schema, markdown);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error extracting data: " + e.getMessage());
        }
    }
}
