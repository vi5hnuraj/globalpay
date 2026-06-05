import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const ScannerComponent = ({ userData }) => {
  const webcamRef = useRef(null);
  const [scanResult, setScanResult] = useState('');
  const [isScanMode, setIsScanMode] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);

  const upiId = userData?.bankDetails?.upiId || '';

  const captureAndScan = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          setScanResult(code.data);
          setIsScanning(false);
          toast.success('QR Code Scanned successfully!');
        } else {
          toast.error('No QR code found in the image. Try again.');
        }
      };
      img.src = imageSrc;
    }
  }, [webcamRef]);

  return (
    <div className="bg-zinc-800 font-mono p-6 rounded-lg border-2 border-zinc-700 shadow-md flex flex-col items-center justify-between h-80 w-[480px]">
      <div className="flex justify-between w-full items-center mb-2">
        <h2 className="text-lg font-bold text-amber-600">
          {isScanMode ? 'Scan QR Code' : 'My QR Code'}
        </h2>
        <button 
          onClick={() => {
            setIsScanMode(!isScanMode);
            setIsScanning(true);
            setScanResult('');
          }}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded text-white transition-colors"
        >
          {isScanMode ? 'Show My QR' : 'Scan Someone'}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center w-full h-full relative">
        {!isScanMode ? (
          isRevealed ? (
            <div className="flex flex-col items-center bg-white p-4 rounded-xl shadow-inner">
              {upiId ? (
                <QRCodeSVG value={upiId} size={150} level="H" />
              ) : (
                <div className="w-[150px] h-[150px] bg-gray-200 flex items-center justify-center">No UPI ID</div>
              )}
              <p className="text-zinc-800 text-xs mt-3 font-bold">{upiId}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-[150px] h-[150px] border-2 border-dashed border-zinc-600 rounded-xl flex flex-col items-center justify-center bg-zinc-800/50 mb-4 opacity-50">
                <span className="text-zinc-500 text-4xl">QR</span>
              </div>
              <button 
                onClick={() => setIsRevealed(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all text-sm"
              >
                Reveal My QR Code
              </button>
            </div>
          )
        ) : isScanning ? (
          <>
            <div className="rounded-lg overflow-hidden border border-zinc-600 mb-2">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-[200px] h-[150px] object-cover"
              />
            </div>
            <button 
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all text-sm"
              onClick={captureAndScan}
            >
              Capture & Scan
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center w-full">
            <p className="text-zinc-400 text-sm mb-2">Scanned Address:</p>
            <p className="text-amber-400 font-bold text-sm bg-zinc-900 w-full px-2 py-3 text-center rounded border border-zinc-700 mb-4 break-all">
              {scanResult}
            </p>
            <button 
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-lg text-sm"
              onClick={() => setIsScanning(true)}
            >
              Scan Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerComponent;