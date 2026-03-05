/**
 * Brand Analysis API Endpoint
 * Scrapes website, analyzes brand, recommends flows
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/app/services/scraper.service';
import { analyzeBrand } from '@/app/services/brand-analysis.service';
import { getSupabase } from '@/app/lib/supabase';

export const maxDuration = 60; // 60 second timeout for scraping + analysis

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`\n🚀 Starting analysis for: ${validatedUrl.href}`);

    // TODO: Re-enable caching after MVP testing
    // Cache disabled for now to always get fresh scrapes with images
    // // Check if we have a recent analysis cached (within 24 hours)
    // const { data: cached } = await supabase
    //   .from('brand_analyses')
    //   .select('*')
    //   .eq('url', validatedUrl.href)
    //   .gte('last_refreshed', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    //   .single();

    // if (cached) {
    //   console.log('✅ Using cached analysis');
    //   return NextResponse.json({
    //     analysisId: cached.id,
    //     cached: true,
    //     analysis: cached.analysis,
    //     recommendedFlows: cached.recommended_flows,
    //   });
    // }

    // Step 1: Scrape website
    console.log('📡 Scraping website...');
    const scrapedData = await scrapeWebsite(validatedUrl.href);

    // Step 2: Analyze brand with AI
    console.log('🧠 Analyzing brand...');
    const brandAnalysis = await analyzeBrand(scrapedData);

    // Step 3: Save to database
    console.log('💾 Saving to database...');
    let saved: any = null;
    let saveError: any = null;
    try {
      const supabase = getSupabase();
      const result = await supabase
      .from('brand_analyses')
      .upsert({
        url: validatedUrl.href,
        analysis: brandAnalysis,
        scraped_content: {
          siteName: scrapedData.siteName,
          tagline: scrapedData.tagline,
          description: scrapedData.description,
        },
        product_data: scrapedData.products,
        brand_colors: brandAnalysis.brandColors,
        brand_voice: brandAnalysis.brandVoice,
        business_model: brandAnalysis.businessModel,
        recommended_flows: brandAnalysis.recommendedFlows.map(f => f.id),
        last_refreshed: new Date().toISOString(),
      }, {
        onConflict: 'url'
      })
      .select()
      .single();

      saved = result.data;
      saveError = result.error;
    } catch (dbError) {
      console.warn('Database not configured, skipping save:', dbError);
    }

    if (saveError) {
      console.error('Database save error:', saveError);
      // Continue anyway - we have the analysis
    }

    console.log('✅ Analysis complete!\n');

    return NextResponse.json({
      analysisId: saved?.id || 'temp-' + Date.now(),
      cached: false,
      analysis: brandAnalysis,
      recommendedFlows: brandAnalysis.recommendedFlows,
      scrapedData: {
        siteName: scrapedData.siteName,
        tagline: scrapedData.tagline,
      },
    });

  } catch (error: any) {
    console.error('❌ Analysis failed:', error);

    return NextResponse.json(
      {
        error: error.message || 'Analysis failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
