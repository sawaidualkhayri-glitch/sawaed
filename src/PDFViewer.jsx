import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function PDFViewer({ fileUrl, title }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const updateWidth = () => {
      setWidth(Math.min(window.innerWidth - 80, 900));
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    setPageNumber(1);
    setError(false);
    setNumPages(null);
  }, [fileUrl]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPageNumber(1);
    setError(false);
  }

  function onDocumentLoadError(err) {
    console.error("PDF document load failed:", err);
    setError(true);
  }

  const documentFile = typeof fileUrl === "string" && fileUrl.trim() ? fileUrl : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", minHeight: "100%" }}>
      <div style={{ width: "100%", maxWidth: 960, minHeight: 320, background: "#111", borderRadius: 16, padding: 16, boxSizing: "border-box" }}>
        <Document
          file={documentFile}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>Loading PDF...</div>}
          error={<div style={{ color: "#fff", textAlign: "center", padding: 24 }}>Failed to load PDF. Check worker path.</div>}
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

      {error && (
        <div style={{ marginTop: 14, color: "#f8d7da", background: "#421013", borderRadius: 12, padding: "12px 14px", width: "100%", maxWidth: 960, textAlign: "center" }}>
          PDF failed to load. Try opening the file in a new tab.
        </div>
      )}

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
    </div>
  );
}
