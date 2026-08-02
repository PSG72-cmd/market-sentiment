"use client";

import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";

export default function ShareButton() {
  const shouldReduce = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  // Close on outside click/tap
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (!e.target.closest(".share-btn-wrapper")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("click", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (isTouch) setIsOpen(!isOpen);
  };

  const handleCopy = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTwitterUrl = () => {
    if (typeof window === "undefined") return "#";
    const text = encodeURIComponent("Check out this financial sentiment analysis!");
    const url = encodeURIComponent(window.location.href);
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  };

  const getLinkedInUrl = () => {
    if (typeof window === "undefined") return "#";
    const url = encodeURIComponent(window.location.href);
    return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  };

  return (
    <div 
      className={`share-btn-wrapper ${isOpen ? "active" : ""}`}
      onMouseEnter={() => !isTouch && setIsOpen(true)}
      onMouseLeave={() => !isTouch && setIsOpen(false)}
    >
      <button 
        className={`share-button-content ${shouldReduce ? "" : "pulse"}`}
        onClick={toggleOpen}
        aria-label="Share options"
      >
        {/* Share Icon SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>

      <div className="share-tooltip-container">
        <div className="share-tooltip-content">
          <a 
            href={getTwitterUrl()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="share-social-icon twitter"
            title="Share on Twitter"
            onClick={() => setIsOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a 
            href={getLinkedInUrl()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="share-social-icon linkedin"
            title="Share on LinkedIn"
            onClick={() => setIsOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <button 
            className="share-social-icon copy"
            onClick={handleCopy}
            title="Copy Link"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
