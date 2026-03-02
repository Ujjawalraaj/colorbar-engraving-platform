import React from 'react';
import { getProductConfig } from '../constants/productHandlers';

// Inline SVG data URI used when no product image is available
const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect width='300' height='400' fill='%23f0f0f0'/%3E%3Crect x='100' y='150' width='100' height='100' rx='8' fill='%23cccccc'/%3E%3Ctext x='150' y='280' font-family='Arial,sans-serif' font-size='13' fill='%23999999' text-anchor='middle'%3EProduct Image%3C/text%3E%3C/svg%3E";

const EngravingPreview = ({ previewData, productName = '' }) => {
  const REFERENCE_WIDTH = 420;
  const IMAGE_MARGIN_TOP = 20;

  const outerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const [innerH, setInnerH] = React.useState('auto');

  React.useEffect(() => {
    if (!outerRef.current) return;
    const measure = () => {
      const parent = outerRef.current.parentElement;
      if (!parent) return;
      const available = parent.clientWidth;
      const s = Math.min(1, available / REFERENCE_WIDTH);
      setScale(s);
      if (innerRef.current) setInnerH(innerRef.current.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outerRef.current.parentElement);
    return () => ro.disconnect();
  }, [previewData]);

  const onImgLoad = () => {
    if (innerRef.current) setInnerH(innerRef.current.offsetHeight * scale);
  };

  if (!previewData) {
    return (
      <div style={{ textAlign: 'center' }}>
        <img src={DEFAULT_IMAGE} alt={productName || 'Product'} style={{ maxWidth: '100%', height: 'auto' }} />
        <p className="text-xs text-gray-500 mt-2">No preview available</p>
        <p className="text-xs text-red-500 mt-1">Preview Data is missing from order</p>
      </div>
    );
  }

  let parsedData;
  try { parsedData = JSON.parse(previewData); }
  catch (e) {
    return (
      <div style={{ textAlign: 'center' }}>
        <img src={DEFAULT_IMAGE} alt="Product" style={{ maxWidth: '100%', height: 'auto' }} />
        <p className="text-xs text-red-500 mt-2">Preview data corrupted</p>
      </div>
    );
  }

  const handlerConfig = getProductConfig(productName);

  const textTop      = (handlerConfig && handlerConfig.textTop)      || parsedData.textTop      || '53%';
  const textLeft     = (handlerConfig && handlerConfig.textLeft)     || parsedData.textLeft     || '60%';
  const textSize     = (handlerConfig && handlerConfig.textSize)     || parsedData.textSize     || '14px';
  const motifMargin  = (handlerConfig && handlerConfig.motifMargin)  || parsedData.motifMargin  || '-0.15em 0 0 0';
  const textTop2     = (handlerConfig && handlerConfig.textTop2)     || parsedData.textTop2     || '50%';
  const textLeft2    = (handlerConfig && handlerConfig.textLeft2)    || parsedData.textLeft2    || '55%';
  const textSize2    = (handlerConfig && handlerConfig.textSize2)    || parsedData.textSize2    || '12px';
  const motifMargin2 = (handlerConfig && handlerConfig.motifMargin2) || parsedData.motifMargin2 || '-0.15em 0 0 0';
  const textOn         = (handlerConfig && handlerConfig.engravingTextOn) || parsedData.engravingTextOn || '1';
  const hasSecondImage = parsedData.hasSecondImage && parsedData.productImage2;
  const img2Width      = (handlerConfig && handlerConfig.image2Width) || parsedData.image2Width || '200px';

  const getFontStyle = (font) => {
    if (!font) return {};
    const l = font.toLowerCase();
    if (l.includes('futura'))   return { fontFamily: '"Futura-Thin", "Futura", system-ui, sans-serif', fontWeight: 300 };
    if (l.includes('rockwell')) return { fontFamily: '"Rockwell", serif', fontWeight: 400 };
    if (l.includes('avant'))    return { fontFamily: '"Avant Garde", "Century Gothic", sans-serif', fontWeight: 400 };
    if (l.includes('english') || l.includes('script'))
      return { fontFamily: '"English Script Local", "Poppins", system-ui, sans-serif', fontWeight: 400 };
    return {};
  };

  const renderTextOverlay = (top, left, size, margin) => (
    <div
      style={{
        position: 'absolute',
        top, left,
        transform: 'translate(-50%, -50%)',
        whiteSpace: 'nowrap',
        fontSize: size,
        letterSpacing: '0.02em',
        color: '#ffffff',
        fontWeight: 400,
        textShadow: '0 0 3px rgba(0,0,0,0.6)',
        display: 'inline-flex',
        gap: 0,
        alignItems: 'center',
        ...getFontStyle(parsedData.font),
      }}
    >
      {parsedData.characters && parsedData.characters.map((item, idx) =>
        item.isMotif ? (
          <span key={idx} style={{
            fontFamily: "'Emoticons'",
            fontSize: '1.35em',
            lineHeight: 0,
            display: 'inline',
            verticalAlign: 'middle',
            margin: margin,
            textTransform: 'none',
          }}>{item.char}</span>
        ) : (
          <span key={idx} style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            lineHeight: 0,
            display: 'inline',
            verticalAlign: 'middle',
          }}>{item.char === ' ' ? '\u00A0' : item.char}</span>
        )
      )}
    </div>
  );

  const innerContent = (
    <div
      ref={innerRef}
      style={{
        width: REFERENCE_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{
        position: 'relative',
        display: 'inline-block',
        overflow: 'hidden',
        width: REFERENCE_WIDTH + 'px',
      }}>
        <img
          src={parsedData.productImage || DEFAULT_IMAGE}
          alt={productName || 'Product'}
          style={{
            width: '100%',
            maxWidth: REFERENCE_WIDTH + 'px',
            height: 'auto',
            display: 'block',
            margin: IMAGE_MARGIN_TOP + 'px auto 0',
          }}
          onLoad={onImgLoad}
          onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
        />
        {(textOn === '1' || textOn === 'both' || !hasSecondImage) &&
          renderTextOverlay(textTop, textLeft, textSize, motifMargin)}
      </div>

      {hasSecondImage && (
        <div style={{ marginTop: 24, textAlign: 'center', width: '100%' }}>
          <div style={{
            position: 'relative',
            display: 'inline-block',
            overflow: 'hidden',
            width: img2Width,
            margin: '0 auto',
          }}>
            <img
              src={parsedData.productImage2}
              alt={`${productName || 'Product'} - View 2`}
              style={{
                maxWidth: img2Width,
                width: '100%',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
              }}
              onLoad={onImgLoad}
              onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
            />
            {(textOn === '2' || textOn === 'both') &&
              renderTextOverlay(textTop2, textLeft2, textSize2, motifMargin2)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%',
        height: typeof innerH === 'number' ? innerH : 'auto',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        flexShrink: 0,
      }}>
        {innerContent}
      </div>
    </div>
  );
};

export default EngravingPreview;
