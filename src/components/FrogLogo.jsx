import React from 'react';
import frogLogo from '../Assets/frog_planner_logo.avif';

const FrogLogo = ({ className = '', style = {} }) => (
  <img src={frogLogo} alt="Frog Planner" className={className} style={style} draggable={false} />
);

export default FrogLogo;
