import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ScrapedImage {
  previewUrl: string;
  hostingPage: string;
  hostingSite: string;
  pageNumber: number;
}

export class ViperGirlsScraper {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async parseThreadUrl(url: string): Promise<{ threadId: string; currentPage?: number }> {
    const urlObj = new URL(url);
    
    // Handle different ViperGirls URL formats
    // Format 1: /threads/thread-name.threadId/
    // Format 2: /threads/threadId-thread-name/
    // Format 3: /threads/threadId-thread-name/?page=X
    
    let threadId: string;
    let pathMatch = urlObj.pathname.match(/\/threads\/.*?\.(\d+)/);
    
    if (!pathMatch) {
      // Try alternative format: /threads/threadId-something/
      pathMatch = urlObj.pathname.match(/\/threads\/(\d+)-/);
    }
    
    if (!pathMatch) {
      // Try another format: just extract any number from the path
      pathMatch = urlObj.pathname.match(/\/threads\/[^\/]*?(\d{6,})/);
    }
    
    if (!pathMatch) {
      throw new Error('Invalid ViperGirls thread URL - could not extract thread ID');
    }
    
    threadId = pathMatch[1];
    
    // Extract current page from URL parameters
    const pageParam = urlObj.searchParams.get('page');
    const currentPage = pageParam ? parseInt(pageParam, 10) : undefined;
    
    return { threadId, currentPage };
  }

  async scrapeThreadPage(threadId: string, page: number): Promise<ScrapedImage[]> {
    const url = `https://vipergirls.to/threads/${threadId}/page-${page}`;
    
    try {
      console.log(`Fetching URL: ${url}`);
      const response = await axios.get(url, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const images: ScrapedImage[] = [];

      console.log(`Page HTML length: ${response.data.length}`);

      // First, decode HTML entities in the entire response
      const decodedHtml = response.data
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#91;/g, '[')
        .replace(/&#93;/g, ']');
      const $decoded = cheerio.load(decodedHtml);

      // Look for image hosting URLs in the decoded HTML content
      const imageHostUrls = new Set<string>();
      
      // Extract only ImageBam and Imgbox URLs as requested
      const urlPatterns = [
        /https?:\/\/(?:www\.)?imagebam\.com\/image\/[a-zA-Z0-9]+/g,
        /https?:\/\/(?:www\.)?imgbox\.com\/[a-zA-Z0-9]+/g
      ];

      for (const pattern of urlPatterns) {
        const matches = decodedHtml.match(pattern);
        if (matches) {
          matches.forEach(url => imageHostUrls.add(url));
        }
      }

      console.log(`Found ${imageHostUrls.size} image hosting URLs`);

      // Now try to find these URLs in the DOM structure to get preview images
      const postSelectors = [
        '.message-body',
        '.bbWrapper', 
        '.post-content',
        '.messageContent',
        '.message-content',
        'article .message',
        '[data-lb-sidebar-href]',
        '.js-post',
        '.message',
        '.post'
      ];

      let foundPosts = false;
      for (const selector of postSelectors) {
        const posts = $decoded(selector);
        if (posts.length > 0) {
          console.log(`Found ${posts.length} posts using selector: ${selector}`);
          foundPosts = true;
          
          posts.each((_, element) => {
            // Look for all links in this post
            $decoded(element).find('a').each((_, linkElement) => {
              const href = $decoded(linkElement).attr('href');
              if (href && this.isImageHostingUrl(href)) {
                // Try to find a preview image
                const img = $decoded(linkElement).find('img');
                let previewUrl = '';
                
                if (img.length > 0) {
                  previewUrl = img.attr('src') || '';
                } else {
                  // If no preview image, try to construct one from the URL
                  previewUrl = this.constructPreviewUrl(href);
                }

                console.log(`Found image: ${href} -> ${previewUrl}`);
                images.push({
                  previewUrl,
                  hostingPage: href,
                  hostingSite: this.extractHostingSite(href),
                  pageNumber: page,
                });
              }
            });
            
            // Also check for URLs in text content that might not be properly linked
            const textContent = $decoded(element).text();
            for (const url of imageHostUrls) {
              if (textContent.includes(url) && !images.some(img => img.hostingPage === url)) {
                const previewUrl = this.constructPreviewUrl(url);
                console.log(`Found text URL: ${url} -> ${previewUrl}`);
                images.push({
                  previewUrl,
                  hostingPage: url,
                  hostingSite: this.extractHostingSite(url),
                  pageNumber: page,
                });
              }
            }
          });
          break; // Use the first working selector
        }
      }

      // If no posts found with selectors, scan for URLs in the entire page
      if (!foundPosts && imageHostUrls.size > 0) {
        console.log('No posts found with selectors, using direct URL extraction');
        for (const url of imageHostUrls) {
          const previewUrl = this.constructPreviewUrl(url);
          console.log(`Direct URL: ${url} -> ${previewUrl}`);
          images.push({
            previewUrl,
            hostingPage: url,
            hostingSite: this.extractHostingSite(url),
            pageNumber: page,
          });
        }
      }

      console.log(`Found ${images.length} images on page ${page}`);
      return images;
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error);
      throw new Error(`Failed to scrape page ${page}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFullResolutionUrl(hostingPageUrl: string): Promise<string> {
    try {
      const response = await axios.get(hostingPageUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const hostingSite = this.extractHostingSite(hostingPageUrl);

      switch (hostingSite) {
        case 'imgur.com':
          return this.extractImgurUrl($, hostingPageUrl);
        case 'imagetwist.com':
          return this.extractImageTwistUrl($);
        case 'postimg.cc':
          return this.extractPostImgUrl($);
        case 'imgbox.com':
          return this.extractImgBoxUrl($);
        default:
          // Generic fallback - look for largest image
          return this.extractGenericImageUrl($);
      }
    } catch (error) {
      console.error(`Error extracting full resolution URL from ${hostingPageUrl}:`, error);
      throw new Error(`Failed to extract image URL from ${hostingPageUrl}`);
    }
  }

  private isImageHostingUrl(url: string): boolean {
    const hostingSites = [
      'imgur.com',
      'imagetwist.com',
      'postimg.cc',
      'imgbox.com',
      'turboimagehost.com',
      'imagebam.com',
      'imagevenue.com'
    ];
    
    return hostingSites.some(site => url.includes(site));
  }

  private extractHostingSite(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private extractImgurUrl($: cheerio.CheerioAPI, originalUrl: string): string {
    // Try to find the direct image URL
    const directImage = $('link[rel="image_src"]').attr('href');
    if (directImage) return directImage;

    // Fallback: construct direct URL from imgur ID
    const idMatch = originalUrl.match(/imgur\.com\/([a-zA-Z0-9]+)/);
    if (idMatch) {
      return `https://i.imgur.com/${idMatch[1]}.jpg`;
    }

    throw new Error('Could not extract imgur image URL');
  }

  private extractImageTwistUrl($: cheerio.CheerioAPI): string {
    const imageUrl = $('.pic img').attr('src') || $('#image').attr('src');
    if (!imageUrl) {
      throw new Error('Could not find image on ImageTwist page');
    }
    return imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
  }

  private extractPostImgUrl($: cheerio.CheerioAPI): string {
    const imageUrl = $('#main-image').attr('src') || $('.image img').attr('src');
    if (!imageUrl) {
      throw new Error('Could not find image on PostImg page');
    }
    return imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
  }

  private extractImgBoxUrl($: cheerio.CheerioAPI): string {
    const imageUrl = $('#img').attr('src') || $('.image img').attr('src');
    if (!imageUrl) {
      throw new Error('Could not find image on ImgBox page');
    }
    return imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
  }

  private extractGenericImageUrl($: cheerio.CheerioAPI): string {
    // Look for common image selectors
    const selectors = [
      'img[src*=".jpg"]',
      'img[src*=".jpeg"]',
      'img[src*=".png"]',
      'img[src*=".gif"]',
      'img[src*=".webp"]'
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      const src = img.attr('src');
      if (src && !src.includes('thumbnail') && !src.includes('preview')) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
    }

    throw new Error('Could not find image URL on page');
  }

  private constructPreviewUrl(hostingPageUrl: string): string {
    try {
      const hostingSite = this.extractHostingSite(hostingPageUrl);
      
      switch (hostingSite) {
        case 'imgbox.com':
          // Extract ID from imgbox URL and construct thumbnail
          const imgboxMatch = hostingPageUrl.match(/imgbox\.com\/([a-zA-Z0-9]+)/);
          if (imgboxMatch) {
            return `https://thumbs2.imgbox.com/t_${imgboxMatch[1]}.jpg`;
          }
          break;
        
        case 'imgur.com':
          // Extract ID from imgur URL
          const imgurMatch = hostingPageUrl.match(/imgur\.com\/([a-zA-Z0-9]+)/);
          if (imgurMatch) {
            return `https://i.imgur.com/${imgurMatch[1]}t.jpg`;
          }
          break;
        
        case 'imagetwist.com':
          // ImageTwist doesn't have a standard thumbnail format, use placeholder
          return '/api/placeholder/150/150';
        
        case 'postimg.cc':
          // PostImg doesn't have a standard thumbnail format, use placeholder
          return '/api/placeholder/150/150';
        
        default:
          return '/api/placeholder/150/150';
      }
      
      return '/api/placeholder/150/150';
    } catch {
      return '/api/placeholder/150/150';
    }
  }
}
