"use client";

import Link from "next/link";
import { ExaminerShell } from "@/components/examiner-shell";

export default function ExaminerPage() {
  return <ExaminerShell><header className="examiner-header"><p className="eyebrow">የቁርአን ክለሳ ፈተና</p><h1>የፈታኝ መቆጣጠሪያ</h1><p>የተመደቡ ተማሪዎችን ይምረጡ።</p></header><section className="examiner-actions"><Link className="examiner-action primary" href="/examiner/test"><span>1</span><div><h2>ፈተና ጀምር</h2><p>የቁርአን ፈተና ውጤት ይሙሉ።</p></div><small>1</small></Link><Link className="examiner-action" href="/examiner/hisnul-muslim"><span>2</span><div><h2>የሂስኑል ሙስሊም ውጤት</h2><p>የረዳት ፈታኙን የወረቀት ውጤት ያስገቡ።</p></div><small>/20</small></Link><Link className="examiner-action" href="/examiner/homework"><span>3</span><div><h2>የቤት ስራ ውጤት</h2><p>የቤት ስራ የወረቀት ውጤት ያስገቡ።</p></div><small>/5</small></Link><Link className="examiner-action" href="/examiner/results"><span>4</span><div><h2>ሙሉ ውጤት ይመልከቱ</h2><p>ሁሉንም የተሞሉ ውጤቶች ይመልከቱ።</p></div><small>/100</small></Link></section></ExaminerShell>;
}
