import React from 'react';
import frogLogo from '../Assets/frog_planner_logo.avif';

const FrogLogo = ({ className = '', style = {}, backgroundless = false, alt = 'Frog Planner', ...props }) => (
  <img
    src={backgroundless ? '/frog-logo-email.png' : frogLogo}
    alt={alt}
    className={className}
    style={style}
    draggable={false}
    {...props}
  />
);

export default FrogLogo;
