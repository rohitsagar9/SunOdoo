'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Group, Paper, Text } from '@mantine/core';
import { Eraser, PenLine } from 'lucide-react';

export function SignaturePad({
  onChange,
  height = 220,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(dpr, dpr);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, height);
    context.strokeStyle = '#0b1f33';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, [height]);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = position(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, height);
    context.strokeStyle = '#0b1f33';
    setHasInk(false);
    onChange(null);
  }

  return (
    <Paper withBorder p="sm" radius="md" bg="white">
      <Group justify="space-between" mb={6}>
        <Group gap={6}>
          <PenLine size={15} />
          <Text fz="xs" fw={600}>
            Customer signature
          </Text>
        </Group>
        <Button
          variant="subtle"
          size="compact-xs"
          color="gray"
          leftSection={<Eraser size={13} />}
          onClick={clear}
        >
          Clear
        </Button>
      </Group>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          width: '100%',
          height,
          display: 'block',
          borderRadius: 8,
          border: '1px dashed #cbd5e1',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
      <Text fz={10} c="dimmed" mt={6}>
        {hasInk ? 'Signature captured — it will be attached to the job card.' : 'Sign with a finger or mouse inside the box.'}
      </Text>
    </Paper>
  );
}
