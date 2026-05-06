import { createFileRoute, useParams, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks/$taskId/edit')({
  component: EditTaskPage,
})

function EditTaskPage() {
  const { taskId } = useParams({ from: '/tasks/$taskId/edit' })
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold">تعديل المهمة {taskId}</h1>
      <p className="mt-4 text-muted-foreground">نموذج التعديل سيتم إضافته لاحقاً.</p>
      <Link to="/" className="mt-6 text-primary underline">
        العودة للرئيسية
      </Link>
    </div>
  )
}
