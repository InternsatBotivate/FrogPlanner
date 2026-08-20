import React from 'react';
import FrogLogo from './FrogLogo';

export const InfoPage = ({ children }) => (
  <div className="info-page scrollbar-hide">{children}</div>
);

export const InfoHero = ({ eyebrow, title, description }) => (
  <section className="info-hero">
    <div className="info-hero__content">
      <span className="info-hero__eyebrow">{eyebrow}</span>
      <h1 className="info-hero__title">{title}</h1>
      <p className="info-hero__description">{description}</p>
    </div>
    <div className="info-hero__mark" aria-hidden="true">
      <FrogLogo className="h-full w-full object-contain" />
    </div>
  </section>
);

export const InfoIcon = ({ icon: Icon, tone = 'green', size = 18 }) => (
  <span className={`info-icon info-icon--${tone}`} aria-hidden="true">
    <Icon size={size} strokeWidth={1.9} />
  </span>
);

export const InfoSectionTitle = ({ icon, children, description }) => (
  <div className="info-section-title">
    <InfoIcon icon={icon} size={17} />
    <div>
      <h2>{children}</h2>
      {description && <p>{description}</p>}
    </div>
  </div>
);
