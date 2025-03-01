import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Task } from './taskProvider';

export class ReportGenerator {
  constructor(private extensionUri: vscode.Uri) { }

  public async generateReport(tasks: Task[]): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const reportsDir = path.join(workspaceFolder.uri.fsPath, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `task-report-${timestamp}.html`);

    const htmlContent = this.generateHtmlContent(tasks);

    fs.writeFileSync(reportPath, htmlContent);

    return reportPath;
  }

  private generateHtmlContent(tasks: Task[]): string {
    const totalTasks = tasks.length;
    const testedTasks = tasks.filter(task => task.status.tested).length;
    const passedTasks = tasks.filter(task => task.status.tested && task.status.passed).length;
    const failedTasks = testedTasks - passedTasks;

    const completionPercentage = totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0;

    const passedTasksList = tasks.filter(task => task.status.tested && task.status.passed);
    const failedTasksList = tasks.filter(task => task.status.tested && !task.status.passed);
    const untestedTasksList = tasks.filter(task => !task.status.tested);

    const passedTasksHtml = this.generateTaskListHtml(passedTasksList, 'passed');
    const failedTasksHtml = this.generateTaskListHtml(failedTasksList, 'failed');
    const untestedTasksHtml = this.generateTaskListHtml(untestedTasksList, 'untested');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Completion Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        h1, h2, h3 {
          color: #2c3e50;
        }
        .summary {
          display: flex;
          justify-content: space-between;
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 30px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-number {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .summary-label {
          font-size: 0.9rem;
          text-transform: uppercase;
          color: #6c757d;
        }
        .progress-bar {
          height: 20px;
          background-color: #e9ecef;
          border-radius: 10px;
          margin-bottom: 30px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background-color: #28a745;
          width: ${completionPercentage}%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          transition: width 0.5s ease;
        }
        .task-list {
          margin-bottom: 30px;
        }
        .task-item {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin-bottom: 10px;
        }
        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .task-name {
          font-weight: bold;
          font-size: 1.1rem;
        }
        .task-status {
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        .status-passed {
          background-color: #d4edda;
          color: #155724;
        }
        .status-failed {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status-untested {
          background-color: #e2e3e5;
          color: #383d41;
        }
        .task-description {
          margin-bottom: 10px;
          color: #6c757d;
        }
        .task-message {
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 5px;
          font-family: monospace;
          white-space: pre-wrap;
        }
        .timestamp {
          text-align: center;
          margin-top: 30px;
          font-size: 0.9rem;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <h1>CodeDrills Practice Report</h1>
      
      <div class="summary">
        <div class="summary-item">
          <div class="summary-number">${totalTasks}</div>
          <div class="summary-label">Total Exercises</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${passedTasks}</div>
          <div class="summary-label">Passed</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${failedTasks}</div>
          <div class="summary-label">Failed</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${totalTasks - testedTasks}</div>
          <div class="summary-label">Untested</div>
        </div>
      </div>
      
      <h2>Completion Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill">${completionPercentage}%</div>
      </div>
      
      <h2>Passed Exercises (${passedTasks})</h2>
      <div class="task-list">
        ${passedTasksHtml}
      </div>
      
      <h2>Failed Exercises (${failedTasks})</h2>
      <div class="task-list">
        ${failedTasksHtml}
      </div>
      
      <h2>Untested Exercises (${totalTasks - testedTasks})</h2>
      <div class="task-list">
        ${untestedTasksHtml}
      </div>
      
      <div class="timestamp">
        Report generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
    `;
  }

  private generateTaskListHtml(tasks: Task[], status: 'passed' | 'failed' | 'untested'): string {
    if (tasks.length === 0) {
      return '<p>No tasks in this category.</p>';
    }

    return tasks.map(task => {
      let statusText: string;
      let statusClass: string;

      switch (status) {
        case 'passed':
          statusText = 'Passed';
          statusClass = 'status-passed';
          break;
        case 'failed':
          statusText = 'Failed';
          statusClass = 'status-failed';
          break;
        case 'untested':
          statusText = 'Untested';
          statusClass = 'status-untested';
          break;
      }

      return `
      <div class="task-item">
        <div class="task-header">
          <div class="task-name">${task.name}</div>
          <div class="task-status ${statusClass}">${statusText}</div>
        </div>
        <div class="task-description">${task.description}</div>
        ${task.status.message ? `<div class="task-message">${task.status.message}</div>` : ''}
      </div>
      `;
    }).join('');
  }
}