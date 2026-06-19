'use client';
import { Card, Title, BarChart, Badge } from "@tremor/react";

const attendanceData = [
  { name: 'Security', present: 45, expected: 50 },
  { name: 'Production', present: 120, expected: 130 },
];

export default function Dashboard() {
  return (
    <main className="p-10 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">GoFresh EMS Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <Title>Live On-Site</Title>
          <div className="text-4xl font-bold text-green-600">165</div>
        </Card>
        
        <Card>
          <Title>Attendance Efficiency</Title>
          <Badge color="emerald">92% Average</Badge>
        </Card>
      </div>

      <Card className="mt-8">
        <Title>Departmental Attendance vs Expected</Title>
        <BarChart
          className="mt-6 h-64"
          data={attendanceData}
          index="name"
          categories={["present", "expected"]}
          colors={["emerald", "gray"]}
        />
      </Card>
    </main>
  );
}