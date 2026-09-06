import React, { useEffect, useRef } from 'react';

/**
 * FallingRaysBg — "Falling Rays" Component (Rain of Light)
 * Generates vertical light rays falling smoothly from the top against a deep dark background.
 */
export default function FallingRaysBg({ rayCount = 45, speedMultiplier = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize ray particles
    const rays = Array.from({ length: rayCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 180 + 80,
      thickness: Math.random() * 2.5 + 0.5,
      speed: (Math.random() * 2.5 + 1.2) * speedMultiplier,
      opacity: Math.random() * 0.7 + 0.2,
      // Color tint variation between cyan, blue, and soft purple
      hue: Math.random() > 0.5 ? 210 + Math.random() * 30 : 250 + Math.random() * 30,
    }));

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep dark background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#030712'); // Slate 950
      bgGradient.addColorStop(0.5, '#0f172a'); // Slate 900
      bgGradient.addColorStop(1, '#020617'); // Blackish
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Render Falling Light Rays
      rays.forEach((ray) => {
        // Create vertical gradient for the ray
        const gradient = ctx.createLinearGradient(ray.x, ray.y, ray.x, ray.y + ray.length);
        gradient.addColorStop(0, `hsla(${ray.hue}, 90%, 80%, 0)`);
        gradient.addColorStop(0.3, `hsla(${ray.hue}, 90%, 75%, ${ray.opacity})`);
        gradient.addColorStop(0.8, `hsla(${ray.hue}, 100%, 70%, ${ray.opacity * 0.6})`);
        gradient.addColorStop(1, `hsla(${ray.hue}, 100%, 70%, 0)`);

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = ray.thickness;
        ctx.moveTo(ray.x, ray.y);
        ctx.lineTo(ray.x, ray.y + ray.length);
        ctx.stroke();

        // Optional glowing ray head particle
        ctx.beginPath();
        ctx.fillStyle = `hsla(${ray.hue}, 100%, 90%, ${ray.opacity * 0.8})`;
        ctx.arc(ray.x, ray.y + ray.length * 0.7, ray.thickness * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Update position
        ray.y += ray.speed;
        if (ray.y > height) {
          ray.y = -ray.length;
          ray.x = Math.random() * width;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [rayCount, speedMultiplier]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
