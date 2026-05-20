import React from 'react';

const Footer = ({ minimal }) => {
  if (minimal) {
    return (
      <div className="text-center">
        <p className="text-[11px] font-bold text-green-700">
          Powered By <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 hover:text-green-900 font-extrabold hover:underline transition-all"
          >
            Botivate
          </a>
        </p>
      </div>
    );
  }

  return (
    <footer className="w-full py-3 md:py-2 border-t border-green-100 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-[13px] md:text-sm font-bold text-green-700">
          Powered By <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 hover:text-green-900 font-extrabold hover:underline transition-all"
          >
            Botivate
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;