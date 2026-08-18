import { SiInstagram } from "@icons-pack/react-simple-icons";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// This build only drives Instagram (see lib/platforms.ts). Everything else
// falls back to a generic icon below instead of carrying an icon/color for
// platforms the product no longer connects.
const platformIcons: Record<string, React.ComponentType<{ className?: string; size?: number; color?: string }>> = {
  instagram: SiInstagram,
};

// Brand colors for platforms. Platforms not listed here use text-foreground.
const platformColors: Record<string, string> = {
  instagram: "#E4405F",
};

export function PlatformIcon({
  platform,
  className,
  size = 16,
}: {
  platform: string;
  className?: string;
  size?: number;
}) {
  const Icon = platformIcons[platform];

  if (!Icon) {
    return <MessageSquare className={cn("text-muted-foreground", className)} style={{ width: size, height: size }} />;
  }

  const brandColor = platformColors[platform];

  return (
    <Icon
      className={cn(!brandColor && "text-foreground", className)}
      size={size}
      {...(brandColor ? { color: brandColor } : {})}
    />
  );
}
