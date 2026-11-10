import MathFormattedText from '@/components/MathFormattedText'

interface TrueFalseCardProps {
  statement: string
  chapter: string
  subject: string
}

export default function TrueFalseCard({ statement, chapter, subject }: TrueFalseCardProps) {
  return (
    <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 sm:p-8 flex-1 flex flex-col justify-between shadow-2xl relative min-h-[220px] select-none">
      <div className="text-[12px] font-bold uppercase tracking-wider text-[#9d94ba] flex items-center justify-between shrink-0">
        <span className="truncate max-w-[200px]">{chapter || 'True / False'}</span>
        {subject && <span className="text-[#8e92a8] text-[12px] font-semibold">{subject}</span>}
      </div>
      <div className="font-display text-[20px] sm:text-[23px] text-center text-white py-6 flex items-center justify-center leading-relaxed flex-1">
        <MathFormattedText text={statement} />
      </div>
      <div className="h-2 shrink-0" />
    </div>
  )
}
