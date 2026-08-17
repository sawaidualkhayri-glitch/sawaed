/* ==========================================================================
   START SECTION: PDF Viewer Component
   ========================================================================== */

import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

  /* --- START SUBSECTION: PDF Worker Configuration --- */
  // Use a static local worker file so pdf.js does not attempt a dynamic fetch while offline.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  /* --- END SUBSECTION: PDF Worker Configuration --- */

  /* --- START SUBSECTION: PDFViewer Component Main --- */
  export default function PDFViewer({ fileUrl, title }) {
    /* --- START STATE MANAGEMENT --- */
    const [numPages, setNumPages] = useState(null);
    const [error, setError] = useState(false);
    const [width, setWidth] = useState(700);
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
    }, [fileUrl]);
    /* --- END FILE URL CHANGE HANDLER --- */

    /* --- START PDF LOAD SUCCESS HANDLER --- */
    function onDocumentLoadSuccess({ numPages }) {
      setNumPages(numPages);
      setError(false);
    }
    /* --- END PDF LOAD SUCCESS HANDLER --- */

    /* --- START PDF LOAD ERROR HANDLER --- */
    function onDocumentLoadError(err) {
      console.error("PDF document load failed:", err);
      setError(true);
    }
    /* --- END PDF LOAD ERROR HANDLER --- */

    /* --- START FILE VALIDATION --- */
    const documentFile = typeof fileUrl === "string" && fileUrl.trim() ? fileUrl : null;
    /* --- END FILE VALIDATION --- */

    return (
      <>
        {/* --- START VIEWER UI CONTAINER --- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%" }}>
          {/* --- START PDF DOCUMENT CONTAINER WITH PROGRESSIVE SCROLLING --- */}
          <div style={{ width: "100%", height: "100%", background: "#111", overflowY: "auto", overflowX: "hidden", padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Document
              file={documentFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>جارٍ تحميل المستند...</div>}
              error={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>فشل تحميل المستند. تحقق من الرابط أو اتصال الإنترنت.</div>}
            >
              {/* --- PROGRESSIVE PAGE RENDERING: Render all pages in scrollable column --- */}
              {numPages && Array.from({ length: numPages }, (_, index) => (
                <div key={index + 1} style={{ width: "100%", maxWidth: width, display: "flex", justifyContent: "center", marginBottom: 12 }}>
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
