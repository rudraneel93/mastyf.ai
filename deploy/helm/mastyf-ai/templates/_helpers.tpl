{{/*
Expand the name of the chart.
*/}}
{{- define "mastyf-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mastyf-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mastyf-ai.labels" -}}
helm.sh/chart: {{ include "mastyf-ai.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "mastyf-ai.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mastyf-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mastyf-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}