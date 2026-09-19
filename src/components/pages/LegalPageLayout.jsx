import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import "./LegalPages.css";

const SUPPORT_EMAIL = "sawaidualkhayri@gmail.com";

export default function LegalPageLayout({ eyebrow, title, intro, sections, documentType }) {
  const [remoteSections, setRemoteSections] = useState(null);
  const [loadingSections, setLoadingSections] = useState(Boolean(documentType));

  useEffect(() => {
    if (!documentType) return undefined;

    const unsubscribe = onSnapshot(collection(db, "legal_documents"), (snapshot) => {
      const nextSections = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.type === documentType && item.title?.trim() && item.content?.trim())
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        .map((item) => ({ title: item.title, body: item.content, email: false }));
      setRemoteSections(nextSections.length > 0 ? nextSections : null);
      setLoadingSections(false);
    }, () => {
      setRemoteSections(null);
      setLoadingSections(false);
    });

    return unsubscribe;
  }, [documentType]);

  const goHome = () => {
    window.location.href = "/";
  };

  return (
    <main className="legal-page" dir="rtl">
      <div className="legal-page__glow legal-page__glow--top" aria-hidden="true" />
      <div className="legal-page__glow legal-page__glow--bottom" aria-hidden="true" />
      <div className="legal-page__container">
        <header className="legal-page__header">
          <div className="legal-page__brand" aria-label="سواعد الخير التعليمية">
            <div>
              <strong>سواعد الخير</strong>
              <span>منصة تعليمية</span>
            </div>
          </div>
          <button className="legal-page__home-button" type="button" onClick={goHome}>
            <span aria-hidden="true">←</span>
            العودة إلى الرئيسية
          </button>
          <p className="legal-page__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-page__intro">{intro}</p>
        </header>

        {loadingSections ? (
          <div className="legal-page__content" aria-label="جارٍ تحميل المحتوى">
            {[1, 2, 3].map((item) => <div className="legal-page__skeleton" key={item} />)}
          </div>
        ) : (
        <div className="legal-page__content">
          {(remoteSections || sections).map((section) => (
            <section className="legal-page__section" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.email ? (
                <a className="legal-page__email" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              ) : null}
            </section>
          ))}
        </div>
        )}

        <footer className="legal-page__footer">
          <button className="legal-page__footer-link" type="button" onClick={goHome}>
            العودة إلى منصة سواعد الخير
          </button>
          <span>© منصة سواعد الخير التعليمية</span>
        </footer>
      </div>
    </main>
  );
}
