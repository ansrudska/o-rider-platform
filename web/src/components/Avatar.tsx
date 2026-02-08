import { Link } from "react-router-dom";

const COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-green-100 text-green-600",
  "bg-purple-100 text-purple-600",
  "bg-pink-100 text-pink-600",
  "bg-yellow-100 text-yellow-700",
  "bg-teal-100 text-teal-600",
];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  userId?: string;
  className?: string;
}

const SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-20 h-20 text-2xl",
};

export default function Avatar({
  name,
  imageUrl,
  size = "md",
  userId,
  className = "",
}: AvatarProps) {
  const sizeClass = SIZES[size];
  const inner = imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizeClass} rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold ${colorFor(name)} ${className}`}
    >
      {name.charAt(0)}
    </div>
  );

  if (userId) {
    return (
      <Link to={`/athlete/${userId}`} className="flex-shrink-0">
        {inner}
      </Link>
    );
  }
  return inner;
}
