import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { utils, writeFile } from "xlsx";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import { tasksQuery, peopleQuery, STATUS_LABEL, PRIORITY_LABEL } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/analises")({ component: AnalyticsPage });
function AnalyticsPage() {
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: people = [] } = useQuery(peopleQuery);
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const data = tasks.map((t) => ({
    Tarefa: t.title,
    Descrição: t.description,
    Prioridade: PRIORITY_LABEL[t.priority],
    Status: STATUS_LABEL[t.status],
    Prazo: t.due_date,
    Criador: name(t.created_by),
    Responsável: name(t.assigned_to),
  }));
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  function excel() {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(data), "Tarefas");
    writeFile(wb, "relatorio-tarefas.xlsx");
  }
  function pdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    const columns = [
      { key: "Tarefa", label: "Tarefa", width: 38 },
      { key: "Descrição", label: "Descrição", width: 68 },
      { key: "Prioridade", label: "Prioridade", width: 25 },
      { key: "Status", label: "Status", width: 30 },
      { key: "Prazo", label: "Prazo", width: 25 },
      { key: "Criador", label: "Criador", width: 42 },
      { key: "Responsável", label: "Responsável", width: 42 },
    ] as const;
    const marginX = 14;
    const pageBottom = 195;
    const lineHeight = 4;

    doc.setFontSize(18);
    doc.text("Relatório de tarefas", 14, 18);

    const drawHeader = (startY: number) => {
      doc.setFillColor(229, 185, 83);
      doc.rect(
        marginX,
        startY,
        columns.reduce((sum, column) => sum + column.width, 0),
        9,
        "F",
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(20, 20, 20);
      let x = marginX;
      columns.forEach((column) => {
        doc.text(column.label, x + 2, startY + 6);
        x += column.width;
      });
      doc.setTextColor(0, 0, 0);
      return startY + 9;
    };

    let y = drawHeader(25);
    data.forEach((item) => {
      const cells = columns.map((column) => ({
        lines: doc.splitTextToSize(String(item[column.key] ?? "—"), column.width - 4),
        width: column.width,
      }));
      const rowHeight = Math.max(
        9,
        Math.max(...cells.map((cell) => cell.lines.length)) * lineHeight + 4,
      );

      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = drawHeader(14);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      let x = marginX;
      cells.forEach((cell) => {
        doc.rect(x, y, cell.width, rowHeight);
        doc.text(cell.lines, x + 2, y + 5);
        x += cell.width;
      });
      y += rowHeight;
    });
    doc.save("relatorio-tarefas.pdf");
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Análises</h1>
          <p className="text-muted-foreground">Visão geral e exportação das tarefas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={excel}>
            <Download /> Excel
          </Button>
          <Button variant="outline" onClick={pdf}>
            <Download /> PDF
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total", tasks.length],
          ["Em andamento", count("em_andamento")],
          ["Concluídas", count("concluida")],
          ["Canceladas", count("cancelada")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-display text-4xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl font-semibold">Taxa de conclusão</h2>
        <p className="mt-3 text-5xl font-bold text-success">
          {tasks.length ? Math.round((count("concluida") / tasks.length) * 100) : 0}%
        </p>
      </div>
    </div>
  );
}
