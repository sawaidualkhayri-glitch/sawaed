/* ==========================================================================
   START SECTION: PDF Viewer Component
   ========================================================================== */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { getPdfBookmark, savePdfBookmark } from "./utils/bookmarksDB.js";

  /* --- START SUBSECTION: PDF Worker Configuration --- */
  // Use a static local worker file so pdf.js does not attempt a dynamic fetch while offline.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  /* --- END SUBSECTION: PDF Worker Configuration --- */

  /* --- START SUBSECTION: PDFViewer Component Main --- */
  export default function PDFViewer({ fileUrl, title, fileId }) {
    /* --- START STATE MANAGEMENT --- */
    const [numPages, setNumPages] = useState(null);
    const [error, setError] = useState(false);
    const [width, setWidth] = useState(700);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [resumePage, setResumePage] = useState(null);
    const [bookmarkLoaded, setBookmarkLoaded] = useState(false);
    const [resumeMessage, setResumeMessage] = useState("");
    const scrollContainerRef = useRef(null);
    const pageRefs = useRef({});
    /* --- END STATE MANAGEMENT --- */

    /* --- START RESPONSIVE RESIZE HANDLER --- */
    useEffect(() => {
      const updateWidth = () => {
        setWidth(Math.min(window.innerWidth - 80, 900));
      };
      updateWidth();
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }, []);
    /* --- END RESPONSIVE RESIZE HANDLER --- */

    /* --- START FILE URL CHANGE HANDLER --- */
    useEffect(() => {
      setError(false);
      setNumPages(null);
      setLoadingProgress(15);
      setCurrentPage(1);
      setResumePage(null);
      setBookmarkLoaded(false);
      setResumeMessage("");
      const progressInterval = window.setInterval(() => {
        setLoadingProgress((previous) => previous < 90 ? previous + 15 : previous);
      }, 150);
      return () => window.clearInterval(progressInterval);
    }, [fileUrl]);

    useEffect(() => {
      let cancelled = false;
      if (!fileId) return undefined;
      setBookmarkLoaded(false);
      getPdfBookmark(fileId).then((bookmark) => {
        if (!cancelled && bookmark?.lastPage > 1) setResumePage(bookmark.lastPage);
      }).catch(() => {}).finally(() => {
        if (!cancelled) setBookmarkLoaded(true);
      });
      return () => { cancelled = true; };
    }, [fileId]);

    useEffect(() => {
      if (!fileId || !bookmarkLoaded || currentPage < 1) return undefined;
      const timer = window.setTimeout(() => {
        savePdfBookmark(fileId, currentPage).catch(() => {});
      }, 500);
      return () => window.clearTimeout(timer);
    }, [fileId, currentPage, bookmarkLoaded]);

    useEffect(() => {
      if (!numPages || !resumePage) return undefined;
      const page = Math.min(resumePage, numPages);
      const timer = window.setTimeout(() => {
        pageRefs.current[page]?.scrollIntoView({ block: "start", behavior: "auto" });
        setCurrentPage(page);
        setResumeMessage(`تم استئناف القراءة من الصفحة ${page}`);
        window.setTimeout(() => setResumeMessage(""), 3000);
      }, 100);
      return () => window.clearTimeout(timer);
    }, [numPages, resumePage]);

    const handleViewerScroll = () => {
      const container = scrollContainerRef.current;
      if (!container || !numPages) return;
      const target = container.getBoundingClientRect().top + 40;
      let closestPage = currentPage;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (let page = 1; page <= numPages; page += 1) {
        const element = pageRefs.current[page];
        if (!element) continue;
        const distance = Math.abs(element.getBoundingClientRect().top - target);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = page;
        }
      }
      if (closestPage !== currentPage) setCurrentPage(closestPage);
    };

    /* --- END FILE URL CHANGE HANDLER --- */

    /* --- START PDF LOAD SUCCESS HANDLER --- */
    function onDocumentLoadSuccess({ numPages }) {
      setNumPages(numPages);
      setError(false);
      setLoadingProgress(100);
    }
    /* --- END PDF LOAD SUCCESS HANDLER --- */

    /* --- START PDF LOAD ERROR HANDLER --- */
    function onDocumentLoadError(err) {
      console.error("PDF document load failed:", err);
      setError(true);
    }
    /* --- END PDF LOAD ERROR HANDLER --- */

    /* --- START FILE VALIDATION --- */
    const documentFile = useMemo(() => (
      typeof fileUrl === "string" && fileUrl.trim()
        ? { url: fileUrl, rangeChunkSize: 65536, disableAutoFetch: false, disableStream: false }
        : null
    ), [fileUrl]);
    /* --- END FILE VALIDATION --- */

    return (
      <>
        {/* --- START VIEWER UI CONTAINER --- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%" }}>
          {resumeMessage && <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 5, background: "rgba(15,23,42,0.92)", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 13 }}>{resumeMessage}</div>}
          {/* --- START PDF DOCUMENT CONTAINER WITH PROGRESSIVE SCROLLING --- */}
          <div ref={scrollContainerRef} onScroll={handleViewerScroll} style={{ width: "100%", height: "100%", background: "#111", overflowY: "auto", overflowX: "hidden", padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Document
              file={documentFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadProgress={({ loaded, total }) => {
                if (total > 0) {
                  setLoadingProgress((previous) => Math.max(previous, Math.min(99, Math.round((loaded / total) * 100))));
                }
              }}
              onLoadError={onDocumentLoadError}
              loading={<div style={{ color: "#fff", textAlign: "center", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}><div style={{ fontSize: "18px", fontWeight: "500" }}>جارٍ تحميل المستند...</div><div style={{ fontSize: "16px", color: "#60a5fa", fontWeight: "bold", direction: "ltr" }}>⏳ {loadingProgress > 0 ? `${loadingProgress}%` : "0%"}</div></div>}
              error={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>فشل تحميل المستند. تحقق من الرابط أو اتصال الإنترنت.</div>}
            >
              {/* --- PROGRESSIVE PAGE RENDERING: Render all pages in scrollable column --- */}
              {numPages && Array.from({ length: numPages }, (_, index) => (
                <div key={index + 1} ref={(element) => { pageRefs.current[index + 1] = element; }} style={{ width: "100%", maxWidth: width, display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <Page
                    pageNumber={index + 1}
                    width={width}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    style={{ display: "block", margin: "0 auto", background: "#111" }}
                  />
                </div>
              ))}
            </Document>
          </div>
          {/* --- END PDF DOCUMENT CONTAINER --- */}

          {/* --- START ERROR MESSAGE DISPLAY --- */}
          {error && (
            <div style={{ marginTop: 14, color: "#f8d7da", background: "#421013", borderRadius: 12, padding: "12px 14px", width: "100%", maxWidth: 960, textAlign: "center" }}>
              فشل تحميل المستند. حاول فتح الملف في تبويب جديد أو اتصل بدعم المستخدمين.
            </div>
          )}
          {/* --- END ERROR MESSAGE DISPLAY --- */}
        </div>
        {/* --- END VIEWER UI CONTAINER --- */}
      </>
    );
  }
  /* --- END SUBSECTION: PDFViewer Component Main --- */

/* ==========================================================================
   END SECTION: PDF Viewer Component
   ========================================================================== */
