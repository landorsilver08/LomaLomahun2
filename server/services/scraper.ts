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
    const url = `https://vipergirls.to/threads/thread.${threadId}/page-${page}`;
    
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const images: ScrapedImage[] = [];

      // Look for image links in posts
      $('.message-body').each((_, element) => {
        $(element).find('a').each((_, linkElement) => {
          const href = $(linkElement).attr('href');
          if (href && this.isImageHostingUrl(href)) {
            // Check if link contains an image preview
            const img = $(linkElement).find('img');
            if (img.length > 0) {
              const previewUrl = img.attr('src') || '';
              images.push({
                previewUrl,
                hostingPage: href,
                hostingSite: this.extractHostingSite(href),
                pageNumber: page,
              });
            }
          }
        });
      });

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
}
