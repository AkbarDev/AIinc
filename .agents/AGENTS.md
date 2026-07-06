# Persistent Image Generation Instructions for News Feed Workflow

This instruction must remain active throughout every execution of the automated workflow. Apply these rules consistently on every scheduled workflow execution.

## Workflow Schedule
* The GitHub Pages workflow is triggered every 5 minutes.
* News source publishers typically release new content approximately every 2 hours, not every 5 minutes.
* Each workflow execution must independently evaluate whether any newly discovered articles require AI-generated images.

## Image Generation Rules
For every workflow execution:
1. Scan all available news feeds.
2. Check every news category without exception.
3. If a news article does not already contain a usable image, generate a high-quality AI image using the article’s headline and summary.
4. Do not skip image generation because a previous workflow execution found no new articles.
5. Continue processing until every eligible article has been evaluated.

## Mandatory Categories
Always process articles across all news categories, including but not limited to:
* AI
* Technology
* Media
* Commerce
* Advertising
* Startups
* Brands

If additional categories are introduced in the future, automatically include them in the image-generation workflow without requiring manual updates.

## Image Quality Requirements
Generated images should:
* Accurately represent the article headline and summary.
* Match the context and tone of the news story.
* Be visually appealing and editorial in style.
* Avoid generic or repetitive imagery.
* Produce unique images for different articles whenever possible.

## Reliability Requirements
* Never assume that a previous execution has already processed all eligible articles.
* Always verify image availability before deciding to skip generation.
* Ensure no eligible article is left without an image because of workflow timing differences between GitHub Actions and news publishers.

## Primary Objective
Maintain complete image coverage across all news feeds by ensuring every eligible article in every category receives an appropriate AI-generated image whenever a source image is unavailable.
