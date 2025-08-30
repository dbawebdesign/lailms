"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import AnimatedGridBackground from '@/components/layout/AnimatedGridBackground';

/**
 * Learnology AI — Affiliate Landing Page
 * ----------------------------------------------------------------------------
 * Matches the landing page styling with dark theme and gradient elements.
 * - Only ONE actionable button (CTA) that links to FirstPromoter.
 * - Audience: Homeschool moms, dads, and families with social reach.
 * - Includes earnings slider (1–100 families) + optional discount slider.
 * - Mobile-first layout matching Learnology AI brand aesthetic.
 */

// FirstPromoter affiliate signup portal URL
// Based on client ID "z8op3lgw" from fprmain.js
const FIRST_PROMOTER_URL = "https://firstpromoter.com/signup/z8op3lgw"; 

// Program constants
const PRICE_PER_MONTH = 40; // Learnology AI monthly price
const RECURRING_PER_CUSTOMER = 10; // $10/mo to affiliate, months 2–11
const RECURRING_MONTHS = 10; // up to 10 months recurring

export default function AffiliatePage() {
  const [families, setFamilies] = useState(25); // 1..100
  const [discountPct, setDiscountPct] = useState(10); // 0..50 first-month discount

  const metrics = useMemo(() => {
    const firstMonthPerCustomer = PRICE_PER_MONTH * (1 - discountPct / 100);
    const firstMonthTotal = firstMonthPerCustomer * families; // 100% of what customer pays month 1

    const monthlyRecurring = RECURRING_PER_CUSTOMER * families; // months 2–11
    const lifetimeRecurringCap = monthlyRecurring * RECURRING_MONTHS; // if all stay 10 months

    const maxBar = Math.max(firstMonthTotal, monthlyRecurring, lifetimeRecurringCap, 1);

    return {
      firstMonthPerCustomer,
      firstMonthTotal,
      monthlyRecurring,
      lifetimeRecurringCap,
      maxBar,
    };
  }, [families, discountPct]);

  // Number formatting
  const fmtUSD = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtUSDc = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="relative px-6 py-4 flex items-center justify-between border-b border-gray-800 z-50">
        <AnimatedGridBackground 
          opacity={0.02}
          patternId="nav-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="flex items-center space-x-8 relative z-10">
          <Link href="/" className="flex items-center">
            <Image
              src="/Horizontal white text.png"
              alt="Learnology AI"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <div className="text-xs text-gray-400">Affiliate Program</div>
        </div>
        <div className="hidden sm:block text-xs text-gray-400">
          For homeschool families who inspire families
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20">
        <AnimatedGridBackground 
          opacity={0.04}
          patternId="hero-grid"
          showFloatingElements={true}
          showCornerElements={true}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-wider text-[#6B5DE5] font-semibold mb-4">
              Transform education with intelligence.
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight leading-tight tracking-tight text-white mb-6">
              Join Learnology AI's{" "}
              <span className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">
                Affiliate Program
              </span>{" "}
              for Homeschool Families
            </h1>
            <p className="text-xl md:text-2xl font-thin text-gray-300 leading-relaxed max-w-4xl mx-auto">
              Earn income, grow your influence, and help families thrive with the
              leading AI-powered learning platform.
            </p>
          </div>

          {/* Benefit Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#FF835D] to-[#E45DE5] rounded-xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-white font-bold text-lg">100%</span>
              </div>
              <h3 className="text-xl font-bold mb-3">First Month</h3>
              <p className="text-gray-300">
                Keep everything customers pay in month 1, even with discount codes.
              </p>
            </div>
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#E45DE5] to-[#6B5DE5] rounded-xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-white font-bold text-lg">$10</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Recurring Income</h3>
              <p className="text-gray-300">
                Earn $10/month for up to 11 months per customer.
              </p>
            </div>
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#6B5DE5] to-[#FF835D] rounded-xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-white font-bold text-lg">20+</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Creator Access</h3>
              <p className="text-gray-300">
                Unlock Creator Program after 20 signups and sell your own classes.
              </p>
            </div>
          </div>

          {/* Why Join Section */}
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 mb-16">
            <div className="text-sm uppercase tracking-wider text-[#6B5DE5] font-semibold mb-4">Why join</div>
            <blockquote className="text-lg md:text-xl text-white leading-relaxed mb-6">
              "Learnology AI's affiliate program is your chance to grow your brand with the leading AI company for homeschool families. Help families experience the best education technology available, receive monthly income from your signups, and get early access to the creator program, where you can market and sell your own classes on our platform. This is the best industry influencer revenue-sharing opportunity."
            </blockquote>
            <div className="bg-black/30 rounded-xl p-6 border border-gray-600">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">★</span>
                </div>
                <h4 className="text-lg font-semibold text-white">Free Access to Learnology AI Platform</h4>
              </div>
              <p className="text-gray-300 ml-11">
                Get complimentary access to our full platform while you're an active affiliate. <span className="text-[#E45DE5] font-semibold">($480 annual value)</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Earnings Calculator */}
      <section className="relative px-6 py-20 bg-gray-900/50">
        <AnimatedGridBackground 
          opacity={0.06}
          patternId="calculator-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">Calculate Your Earnings</h2>

            {/* Families Slider */}
            <div className="mb-8">
              <label htmlFor="families" className="block text-lg font-medium text-white mb-4">
                How many families can you help with Learnology AI?
              </label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 min-w-[20px]">1</span>
                <div className="flex-1 relative">
                  <input
                    id="families"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={families}
                    onChange={(e) => setFamilies(parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6B5DE5] slider-families"
                    aria-valuemin={1}
                    aria-valuemax={100}
                    aria-valuenow={families}
                  />
                </div>
                <span className="text-sm text-gray-400 min-w-[30px]">100</span>
              </div>
              <div className="mt-3 text-center">
                <span className="text-gray-300">Selected: </span>
                <span className="font-bold text-[#6B5DE5] text-lg">{families} families</span>
              </div>
            </div>

            {/* Discount Slider */}
            <div className="mb-8">
              <label htmlFor="discount" className="block text-lg font-medium text-white mb-4">
                Typical first-month discount you plan to offer (% off)
              </label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 min-w-[25px]">0%</span>
                <div className="flex-1 relative">
                  <input
                    id="discount"
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E45DE5] slider-discount"
                    aria-valuemin={0}
                    aria-valuemax={50}
                    aria-valuenow={discountPct}
                  />
                </div>
                <span className="text-sm text-gray-400 min-w-[30px]">50%</span>
              </div>
              <div className="mt-3 text-center">
                <span className="text-gray-300">Selected: </span>
                <span className="font-bold text-[#E45DE5] text-lg">{discountPct}% off</span>
                <span className="text-gray-300"> → First-month per customer: </span>
                <span className="font-bold text-white">{fmtUSDc(metrics.firstMonthPerCustomer)}</span>
              </div>
            </div>

            {/* Earnings Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-black/50 border border-gray-600 rounded-xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">First month (upfront)</div>
                <div className="text-3xl font-bold text-[#FF835D] mb-2">{fmtUSD(metrics.firstMonthTotal)}</div>
                <div className="text-xs text-gray-300">
                  You earn 100% of what your customers pay in month 1 with your discount.
                </div>
              </div>
              <div className="bg-black/50 border border-gray-600 rounded-xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">Monthly recurring (months 2–11)</div>
                <div className="text-3xl font-bold text-[#E45DE5] mb-2">{fmtUSD(metrics.monthlyRecurring)}<span className="text-lg">/mo</span></div>
                <div className="text-xs text-gray-300">
                  {fmtUSD(RECURRING_PER_CUSTOMER)} × {families} families.
                </div>
              </div>
              <div className="bg-black/50 border border-gray-600 rounded-xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">Total potential over 11 months</div>
                <div className="text-3xl font-bold text-[#6B5DE5] mb-2">{fmtUSD(metrics.firstMonthTotal + metrics.lifetimeRecurringCap)}</div>
                <div className="text-xs text-gray-300">
                  Assumes all customers stay the full 11 months.
                </div>
              </div>
            </div>

            {/* Visual Chart */}
            <div className="bg-black/30 border border-gray-600 rounded-xl p-6">
              <div className="text-lg font-medium text-white mb-6 text-center">Earnings Visualization</div>
              <div className="grid grid-cols-3 items-end gap-6 h-48">
                {[
                  { label: "First month", value: metrics.firstMonthTotal, color: "bg-gradient-to-t from-[#FF835D] to-[#FF835D]/80" },
                  { label: "Monthly recurring", value: metrics.monthlyRecurring, color: "bg-gradient-to-t from-[#E45DE5] to-[#E45DE5]/80" },
                  { label: "11-month total", value: metrics.firstMonthTotal + metrics.lifetimeRecurringCap, color: "bg-gradient-to-t from-[#6B5DE5] to-[#6B5DE5]/80" },
                ].map((b, i) => {
                  const height = Math.max(15, Math.round((b.value / metrics.maxBar) * 100));
                  return (
                    <div key={i} className="flex flex-col items-center justify-end h-full">
                      <div className="text-sm text-white mb-2 font-semibold">{fmtUSD(b.value)}</div>
                      <div
                        aria-label={`${b.label} ${fmtUSD(b.value)}`}
                        className={`w-20 rounded-t-lg ${b.color} transition-all duration-500 ease-in-out shadow-lg`}
                        style={{ height: `${height}%` }}
                      />
                      <div className="mt-3 text-sm font-medium text-gray-300 text-center">{b.label}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 text-xs text-gray-400 text-center">
                Estimates shown for illustration only; actual earnings vary based on discounting and retention.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Program Details */}
      <section className="relative px-6 py-20">
        <AnimatedGridBackground 
          opacity={0.03}
          patternId="details-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-2xl font-bold text-white mb-6">How It Works</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[#FF835D] to-[#E45DE5] text-white rounded-full text-sm font-bold flex items-center justify-center">1</span>
                  <span className="text-gray-300">Apply through FirstPromoter and get your unique link + discount code.</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[#E45DE5] to-[#6B5DE5] text-white rounded-full text-sm font-bold flex items-center justify-center">2</span>
                  <span className="text-gray-300">Share Learnology AI with your homeschool audience via social media.</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[#6B5DE5] to-[#FF835D] text-white rounded-full text-sm font-bold flex items-center justify-center">3</span>
                  <span className="text-gray-300">Month 1: Earn 100% of your customer's first payment (after your discount).</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[#FF835D] to-[#E45DE5] text-white rounded-full text-sm font-bold flex items-center justify-center">4</span>
                  <span className="text-gray-300">Months 2–11: Earn {fmtUSD(RECURRING_PER_CUSTOMER)} per month per active customer.</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[#E45DE5] to-[#6B5DE5] text-white rounded-full text-sm font-bold flex items-center justify-center">5</span>
                  <span className="text-gray-300">After 20 signups: Unlock early access to the Creator Program to sell your own classes.</span>
                </li>
              </ol>
            </div>
            
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-2xl font-bold text-white mb-6">Perfect For</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">You're a great fit if you...</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="text-[#6B5DE5] text-lg">✓</span>
                      <span className="text-gray-300">Are a <span className="font-medium text-white">homeschool mom, dad, or family educator</span></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#6B5DE5] text-lg">✓</span>
                      <span className="text-gray-300">Have an active social media presence (YouTube, Instagram, TikTok, Facebook, blogs)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#6B5DE5] text-lg">✓</span>
                      <span className="text-gray-300">Are committed to ethical promotion and empowering families</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">What you'll get...</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="text-[#E45DE5] text-lg">★</span>
                      <span className="text-gray-300"><span className="font-medium text-white">Free access</span> to Learnology AI <span className="text-[#E45DE5] font-semibold">($480 value)</span></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#E45DE5] text-lg">★</span>
                      <span className="text-gray-300">Build reliable <span className="font-medium text-white">{fmtUSD(RECURRING_PER_CUSTOMER)}/month recurring income</span> per signup</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#E45DE5] text-lg">★</span>
                      <span className="text-gray-300">Exclusive <span className="font-medium text-white">Creator Program access</span> after 20 signups</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative px-6 py-20 bg-gray-900/50">
        <AnimatedGridBackground 
          opacity={0.05}
          patternId="cta-grid"
          showFloatingElements={true}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-center md:text-left flex-1">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Your impact starts here.
                </h3>
                <p className="text-white/90 text-lg">
                  Become a Learnology AI affiliate and help families flourish.
                </p>
              </div>
              <a
                href={FIRST_PROMOTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-semibold bg-white text-black shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#6B5DE5]"
                aria-label="Sign up as an affiliate via FirstPromoter"
              >
                Sign Up as an Affiliate
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 px-6 py-16">
        <AnimatedGridBackground 
          opacity={0.03}
          patternId="footer-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <p className="text-sm text-gray-400 text-center leading-relaxed">
              Month 1 commission equals 100% of the amount paid by the customer after your discount code is applied.
              Recurring commission is {fmtUSD(RECURRING_PER_CUSTOMER)} per active customer per month for up to {RECURRING_MONTHS} months
              (months 2–11). Actual earnings depend on discounting and customer retention.
            </p>
          </div>
        </div>
      </footer>
      
      <style jsx>{`
        /* Custom slider styles for better visibility */
        .slider-families::-webkit-slider-thumb {
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #6B5DE5;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(107, 93, 229, 0.4);
          transition: all 0.2s ease-in-out;
          border: 2px solid white;
        }
        
        .slider-families::-webkit-slider-thumb:hover {
          background: #5A4FCF;
          box-shadow: 0 4px 12px rgba(107, 93, 229, 0.6);
          transform: scale(1.1);
        }
        
        .slider-families::-webkit-slider-track {
          background: linear-gradient(to right, #6B5DE5 0%, #6B5DE5 ${families}%, #374151 ${families}%, #374151 100%);
          height: 12px;
          border-radius: 6px;
        }
        
        .slider-discount::-webkit-slider-thumb {
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #E45DE5;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(228, 93, 229, 0.4);
          transition: all 0.2s ease-in-out;
          border: 2px solid white;
        }
        
        .slider-discount::-webkit-slider-thumb:hover {
          background: #D946EF;
          box-shadow: 0 4px 12px rgba(228, 93, 229, 0.6);
          transform: scale(1.1);
        }
        
        .slider-discount::-webkit-slider-track {
          background: linear-gradient(to right, #E45DE5 0%, #E45DE5 ${discountPct * 2}%, #374151 ${discountPct * 2}%, #374151 100%);
          height: 12px;
          border-radius: 6px;
        }
        
        /* Firefox styles */
        .slider-families::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #6B5DE5;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(107, 93, 229, 0.4);
          transition: all 0.2s ease-in-out;
        }
        
        .slider-families::-moz-range-thumb:hover {
          background: #5A4FCF;
          box-shadow: 0 4px 12px rgba(107, 93, 229, 0.6);
          transform: scale(1.1);
        }
        
        .slider-discount::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #E45DE5;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(228, 93, 229, 0.4);
          transition: all 0.2s ease-in-out;
        }
        
        .slider-discount::-moz-range-thumb:hover {
          background: #D946EF;
          box-shadow: 0 4px 12px rgba(228, 93, 229, 0.6);
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
