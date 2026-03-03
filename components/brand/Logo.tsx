import Image from "next/image";
import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo">
      <Image src="/nextapp.svg" alt="NEXT" width={52} height={20} priority />
    </Link>
  );
}
