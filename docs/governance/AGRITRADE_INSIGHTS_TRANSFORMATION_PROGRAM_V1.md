# AGRITRADE-INSIGHTS TRANSFORMATION PROGRAM V1.0

## Status

APPROVED

## Approval Authority

* CTO Review Completed
* Haiku Strategic Reviews Completed
* Sonnet Architecture Reviews Completed

Version: 1.0

Date: June 2026

---

# Executive Summary

AgriTrade-Insights is an existing live production application currently used for importing, storing, analyzing, and reporting international trade data.

The objective of this program is to transform AgriTrade-Insights into the company's central Trade Intelligence Platform while maintaining continuous production operation and minimizing implementation risk.

This program explicitly prioritizes:

* Production stability
* Internal business value
* Trade intelligence
* Data quality
* Discovery capabilities
* Analytics
* Business development support

The program does not currently prioritize:

* SaaS commercialization
* Multi-tenant deployment
* Subscription monetization
* AI-first development

These initiatives may be evaluated only after the platform reaches maturity and demonstrates strong internal adoption.

---

# Strategic Mission

Transform AgriTrade-Insights from a trade reporting application into a mature internal Trade Intelligence Platform that supports:

* Executive decision making
* Market intelligence
* Buyer discovery
* Supplier discovery
* Product intelligence
* Country intelligence
* Trade relationship intelligence
* Business development activities

while remaining fully operational throughout all development phases.

---

# Strategic Principles

## Principle 1 – Production First

The application is already operational.

The live system must never be jeopardized.

### Mandatory Rules

* No complete rewrites
* No database replacement
* No frontend replacement
* No backend replacement
* No disruptive migrations
* No large-scale refactoring

All enhancements must be:

* Additive
* Incremental
* Low-risk
* Production-safe

---

## Principle 2 – Trusted Data Before Intelligence

Trade intelligence is only valuable when built upon trusted entities.

### Required Sequence

Raw Trade Data

↓

Company Master

↓

Product Taxonomy

↓

Country Intelligence

↓

Discovery

↓

360 Profiles

↓

Trade Relationship Intelligence

↓

Advanced Intelligence

↓

AI

No intelligence feature should be developed before the required data foundation exists.

---

## Principle 3 – Internal Business Value First

Current objectives:

* Improve buyer discovery
* Improve supplier discovery
* Improve sourcing decisions
* Improve market research
* Improve trade intelligence
* Improve executive decision making

Current objectives do NOT include:

* SaaS launch
* Subscription billing
* Monetization planning
* External customer acquisition

---

## Principle 4 – Measure Adoption

Feature completion is not success.

User adoption is success.

Every major feature must be measurable.

Required metrics:

* Daily active users
* Searches performed
* Profiles viewed
* Watchlists created
* Notes added
* Tasks completed

---

# Phase Structure

---

# Phase 1A – Foundation & Security

Duration:

Weeks 1–4

## Objectives

Establish security, analytics foundation, adoption tracking, and master data structures.

## Security Workstream

### Deliverables

* Create read-only PostgreSQL role for analytics
* Separate Superset database access
* Rotate JWT secrets
* Remove weak secrets from repository
* Restrict CORS to approved origins

### Goal

Improve security posture without impacting production.

---

## Analytics Foundation

### Deliverables

* Deploy Apache Superset
* Connect using read-only database account
* Create initial dashboard framework

### Initial Dashboards

* Executive Dashboard
* Trade Flow Dashboard
* Operational Dashboard

### Decision

Apache Superset is the approved analytics platform.

Metabase is not approved.

---

## Adoption Governance

### Deliverables

user_event_log

Track:

* Searches
* Profile views
* Watchlist actions
* Notes
* Tasks

### Goal

Enable future Adoption Dashboard reporting.

---

## Master Data Foundation

### Deliverables

company_master

company_alias

### Scope

Focus only on the most recent 12–18 months of trade data.

Historical data beyond this period may be resolved later.

---

# Phase 1B – Master Data Governance

Duration:

Weeks 5–8

## Objectives

Create trusted business entities.

---

## Company Resolution

### Resolution Model

High Confidence

→ Automatic Merge

Medium Confidence

→ Review Queue

Low Confidence

→ Unresolved

### Governance Rules

* All mappings must be reversible
* No destructive merges
* Maintain auditability

---

## Product Taxonomy Foundation

### Deliverables

* Product Master
* HS Code Mapping
* Category Mapping
* Product Normalization

---

## Country Intelligence

### Deliverables

Country Intelligence Module

Examples:

* Country trends
* Top products
* Top importers
* Top exporters
* Trade growth

Country Intelligence may proceed earlier because country data is already relatively clean.

---

## Analytics Expansion

### Dashboards

Data Health Dashboard

Metrics:

* Company resolution %
* Product resolution %
* Unresolved entities

Trade Flow Dashboard

Metrics:

* Volume
* Value
* Country trends
* Product trends

---

## Week 8 Governance Review

### Outcome A

Resolution ≥ 70%

Proceed normally.

### Outcome B

Resolution 40–70%

Proceed with confidence indicators.

### Outcome C

Resolution < 40%

Extend resolution work before continuing.

---

# Phase 1C – Discovery & Profiles

Duration:

Weeks 9–12

## Objectives

Deliver practical business value.

---

## Buyer Discovery

Capabilities:

* Search buyers
* Filter buyers
* Rank buyers
* Country filtering
* Product filtering

---

## Supplier Discovery

Capabilities:

* Search suppliers
* Product filtering
* Country filtering
* Trade volume analysis

---

## Importer 360 Profile

Features:

* Trade history
* Top products
* Top countries
* Trend analysis
* Related entities

---

## Exporter 360 Profile

Features:

* Trade history
* Product mix
* Market distribution
* Growth trends
* Related entities

---

## Business Development Workspace

Approved Scope Only:

* Watchlists
* Contacts
* Notes
* Tasks

Explicitly Excluded:

* CRM pipelines
* Deal stages
* Forecasting
* Marketing automation
* Email campaigns
* Workflow engines

---

## Adoption Dashboard

Required Metrics:

* Daily active users
* Searches
* Profile views
* Watchlist usage
* Notes activity
* Task activity

---

# Phase 2 – Trade Intelligence

Duration:

Months 4–6

## Objectives

Reveal business opportunities hidden in trade data.

---

## Trade Relationship Intelligence

Examples:

* Buyer → Supplier relationships
* Product trade flows
* Country trade routes
* Supplier concentration analysis
* Opportunity discovery

---

## Product Intelligence

Features:

* Product profiles
* Product trends
* Product growth analysis
* Market opportunities

---

## Analytics Expansion

New Dashboards:

* Product Intelligence Dashboard
* Country Intelligence Dashboard
* Relationship Dashboard

---

# Phase 3 – Advanced Intelligence

Duration:

Months 7–12

## Objectives

Become the company's primary intelligence platform.

---

## Intelligence Modules

* Market Intelligence
* Competitor Intelligence
* Pricing Intelligence

---

## Team Collaboration

Features:

* Shared research
* Shared notes
* Activity history
* Collaborative intelligence

---

# Phase 4 – Future Evaluation

Timeline:

Year 2+

Only after successful adoption and demonstrated business value.

Potential future initiatives:

* AI Assistant
* Predictive Analytics
* Recommendation Engines
* Multi-Tenant Architecture
* SaaS Platform
* Monetization Strategy

No commitment exists to pursue these initiatives.

Evaluation will occur after completion of earlier phases.

---

# Success Criteria

The program is considered successful when:

* Management uses the platform regularly
* Sales teams use discovery tools
* Procurement teams use supplier intelligence
* Trade data quality significantly improves
* Business decisions increasingly rely on platform intelligence
* Excel dependency decreases
* Adoption metrics show sustained usage

---

# Final Governance Statement

AgriTrade-Insights will evolve into a mature Internal Trade Intelligence Platform built upon:

* Trusted Master Data
* Discovery
* Intelligence
* Analytics
* Business Development Support

while remaining live, stable, and production-safe throughout every phase of development.

All future project decisions must align with this document.

END OF DOCUMENT
