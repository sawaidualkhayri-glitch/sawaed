/* ==========================================================================
   START SECTION: PDF Viewer Component
   ========================================================================== */

import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

  /* --- START SUBSECTION: PDF Worker Configuration --- */
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
  /* --- END SUBSECTION: PDF Worker Configuration --- */

  /* --- START SUBSECTION: PDFViewer Component Main --- */
  export default function PDFViewer({ fileUrl, title }) {
    /* --- START STATE MANAGEMENT --- */
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
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
      setPageNumber(1);
      setError(false);
      setNumPages(null);
    }, [fileUrl]);
    /* --- END FILE URL CHANGE HANDLER --- */

    /* --- START PDF LOAD SUCCESS HANDLER --- */
    function onDocumentLoadSuccess({ numPages }) {
      setNumPages(numPages);
      setPageNumber(1);
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", minHeight: "100%" }}>
          {/* --- START PDF DOCUMENT CONTAINER --- */}
          <div style={{ width: "100%", maxWidth: 960, minHeight: 320, background: "#111", borderRadius: 16, padding: 16, boxSizing: "border-box" }}>
            <Document
              file={documentFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>Loading PDF...</div>}
              error={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>Failed to load PDF. Check worker path or proxy response.</div>}
            >
              <div style={{ display: "flex", justifyContent: "center", width: "100%", background: "#111" }}>
                <div style={{ width: "100%", maxWidth: width, display: "flex", justifyContent: "center" }}>
                  <Page
                    pageNumber={pageNumber}
                    width={width}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    style={{ display: "block", margin: "0 auto", background: "#111" }}
                  />
                </div>
              </div>
            </Document>
          </div>
          {/* --- END PDF DOCUMENT CONTAINER --- */}

          {/* --- START ERROR MESSAGE DISPLAY --- */}
          {error && (
            <div style={{ marginTop: 14, color: "#f8d7da", background: "#421013", borderRadius: 12, padding: "12px 14px", width: "100%", maxWidth: 960, textAlign: "center" }}>
              PDF failed to load. Try opening the file in a new tab or reloading the worker.
            </div>
          )}
          {/* --- END ERROR MESSAGE DISPLAY --- */}

          {/* --- START PAGE NAVIGATION CONTROLS --- */}
          {numPages && !error && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 14, width: "100%", maxWidth: 960 }}>
              <button
                type="button"
                onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                disabled={pageNumber <= 1}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", cursor: pageNumber <= 1 ? "not-allowed" : "pointer", background: pageNumber <= 1 ? "#444" : "#5b52d4", color: "#fff" }}
              >
                Previous
              </button>
              <span style={{ color: "#fff", fontSize: 14 }}>
                Page {pageNumber} of {numPages}
              </span>
              <button
                type="button"
                onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
                disabled={pageNumber >= numPages}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", cursor: pageNumber >= numPages ? "not-allowed" : "pointer", background: pageNumber >= numPages ? "#444" : "#5b52d4", color: "#fff" }}
              >
                Next
              </button>
            </div>
          )}
          {/* --- END PAGE NAVIGATION CONTROLS --- */}
        </div>
        {/* --- END VIEWER UI CONTAINER --- */}
      </>
    );
  }
  /* --- END SUBSECTION: PDFViewer Component Main --- */

/* ==========================================================================
   END SECTION: PDF Viewer Component
   ========================================================================== */
