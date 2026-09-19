import "./LegalPages.css";

const SUPPORT_EMAIL = "sawaidualkhayri@gmail.com";

export default function LegalPageLayout({ eyebrow, title, intro, sections }) {
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

        <div className="legal-page__content">
          {sections.map((section) => (
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
