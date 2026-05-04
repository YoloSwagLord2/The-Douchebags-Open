interface CameraIconProps {
  className?: string;
}

export function CameraIcon({ className }: CameraIconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.4l1.2-1.6A1 1 0 0 1 9.9 4h4.2a1 1 0 0 1 .8.4L16.1 6h1.4A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 15.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
