import type { Metadata } from 'next';
import BulkInquiryForm from '@/components/modules/BulkInquiryForm';

export const metadata: Metadata = {
  title: 'خرید عمده محصولات مزارع فارس',
  description:
    'فرم استعلام خرید عمده تخم‌مرغ، عسل، عرقیات و محصولات ارگانیک مزارع فارس برای رستوران‌ها، فروشگاه‌ها و سازمان‌ها با ارسال به سراسر کشور.',
  alternates: { canonical: '/bulk' },
};

export default function BulkPage() {
  return <BulkInquiryForm />;
}
