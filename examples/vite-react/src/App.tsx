import React, { useMemo, useState } from 'react'
import {
  ApwPdfProvider,
  PdfDownloadButton,
  PdfPreview,
} from '@apw-pdf/react'
import { memo, type MemoInput } from '@apw-pdf/templates'

const initialMemo = memo.example as MemoInput
const APP_ASSETS = { garuda: '/assets/garuda-placeholder.png' }

export function App() {
  const [agency, setAgency] = useState(initialMemo.agency)
  const [docNo, setDocNo] = useState(initialMemo.docNo)
  const [date, setDate] = useState(String(initialMemo.date))
  const [subject, setSubject] = useState(initialMemo.subject)
  const [to, setTo] = useState(initialMemo.to)
  const [bodyText, setBodyText] = useState(initialMemo.body.join('\n\n'))
  const [signerName, setSignerName] = useState(initialMemo.signer.name)
  const [signerPositions, setSignerPositions] = useState(
    initialMemo.signer.positions.join('\n'),
  )

  const data = useMemo<MemoInput>(
    () => ({
      agency,
      docNo,
      date,
      subject,
      to,
      body: bodyText
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean),
      signer: {
        name: signerName,
        positions: signerPositions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    }),
    [agency, docNo, date, subject, to, bodyText, signerName, signerPositions],
  )

  return (
    <ApwPdfProvider
      fontBaseUrl="/fonts"
      wasmUrl="/harfbuzz-subset.wasm"
      assets={APP_ASSETS}
      worker
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          padding: '24px',
          fontFamily: 'sans-serif',
        }}
      >
        <div>
          <h1>บันทึกข้อความราชการ (Live PDF Preview)</h1>
          <div style={{ display: 'grid', gap: '12px' }}>
            <label>
              ส่วนราชการ
              <input
                style={{ width: '100%' }}
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
              />
            </label>
            <label>
              ที่
              <input
                style={{ width: '100%' }}
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
              />
            </label>
            <label>
              วันที่ (YYYY-MM-DD)
              <input
                style={{ width: '100%' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              เรื่อง
              <input
                style={{ width: '100%' }}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label>
              เรียน
              <input
                style={{ width: '100%' }}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              เนื้อหา (คั่นย่อหน้าด้วยบรรทัดว่าง)
              <textarea
                rows={6}
                style={{ width: '100%' }}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </label>
            <label>
              ชื่อผู้ลงนาม
              <input
                style={{ width: '100%' }}
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </label>
            <label>
              ตำแหน่งผู้ลงนาม (บรรทัดละ 1 ตำแหน่ง)
              <textarea
                rows={3}
                style={{ width: '100%' }}
                value={signerPositions}
                onChange={(e) => setSignerPositions(e.target.value)}
              />
            </label>
            <div>
              <PdfDownloadButton
                doc={memo.document}
                data={data}
                fileName="memo.pdf"
              >
                ดาวน์โหลด PDF (memo.pdf)
              </PdfDownloadButton>
            </div>
          </div>
        </div>
        <div>
          <PdfPreview doc={memo.document} data={data} scale={1} />
        </div>
      </div>
    </ApwPdfProvider>
  )
}
