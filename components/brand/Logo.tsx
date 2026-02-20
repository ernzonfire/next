import Image from "next/image";
import Link from "next/link";

export default function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="logo">
      <Image src="/next.svg" alt="NEXT" width={36} height={36} />
    </Link>
  );
}
