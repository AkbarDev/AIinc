Enhanced Project Prompt: Global Trending News Aggregation & Intelligence System

Project Title

Design and Implement a Real-Time Global Trending News Aggregation Platform Using Open RSS Feeds

Project Objective

To design, develop, and deploy a high-performance, SEO-optimized, and user-centric web platform that automatically identifies, aggregates, and displays globally trending news and media content by analyzing open RSS feeds from verified international publishers, technology platforms, and research organizations.

The platform will prioritize relevance, freshness, and credibility while maintaining a lightweight, scalable, and open-source architecture suitable for static hosting environments.

Problem Statement

Digital news content is fragmented across thousands of platforms, making it difficult for users to identify high-impact, trending, and trustworthy stories in real time.

Most aggregators display chronological feeds without context, leading to information overload and reduced engagement.

This project addresses the need for a trend-focused intelligence layer that filters and surfaces only the most relevant global news.

Project Scope

The system will:

Collect RSS feeds from globally recognized publishers

Perform real-time trend detection and relevance scoring

Filter duplicate and low-impact stories

Rank content based on popularity and velocity

Categorize trends by domain and geography

Display prioritized trending news in a responsive interface

The solution will remain fully open-source and cost-free.

SDLC-Based Implementation Framework

1. Research & Data Strategy Phase

Identify high-authority global media sources

Validate RSS feed reliability and update frequency

Define trend indicators (frequency, recency, cross-source coverage)

Establish credibility scoring parameters

Deliverable: Source & Trend Evaluation Report

2. System Architecture Design

Architecture Overview

User Browser
     ->
Static Web Platform (GitHub Pages)
     ->
Trend Analysis Engine (JS / GitHub Actions)
     ->
RSS Aggregation Layer
     ->
Global News Providers

Core Components

Feed Collector: Fetches RSS data
Normalizer: Standardizes metadata
Deduplicator: Removes repeats
Trend Engine: Ranks stories
Renderer: Displays content

3. Trend Detection Methodology

The platform will determine trending content using:

Primary Signals

Multi-source coverage frequency

Publication velocity

Time-weighted relevance

Keyword momentum

Topic clustering

Secondary Signals

Publisher authority score

Historical engagement trends

Geographic spread

Scoring Model (Example)

Trend Score = (Source_Count x 0.3) +
              (Recency x 0.25) +
              (Keyword_Volume x 0.2) +
              (Authority x 0.15) +
              (Engagement x 0.1)

4. Development Phase

Functional Modules

A. RSS Ingestion Module

Parallel feed fetching

Failure recovery

Rate-limit handling

B. Processing Engine

NLP-based topic extraction

Duplicate detection

Cluster formation

C. Ranking System

Weighted scoring

Real-time recalculation

D. Presentation Layer

Trending dashboards

Timeline visualization

Topic-based filters

5. SEO & Performance Optimization

SEO Strategy

Structured data (NewsArticle schema)

Dynamic metadata injection

Sitemap automation

Canonical tagging

Performance Strategy

Server-side precomputation

Edge caching

Lazy rendering

Progressive hydration

6. Testing & Validation

Accuracy: >= 90% relevant trends
Latency: < 2s initial load
SEO: Lighthouse > 90
UX: Bounce rate < 35%

7. Deployment & Operations

GitHub Actions scheduling

Automated feed refresh

Monitoring dashboards

Backup pipelines
