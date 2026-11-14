import {app} from 'electron'
import {createDiagnosticRecorder} from './hadronDiagnosticRecorder.js'
const directory=process.argv.find(argument=>argument.startsWith('--hadron-diagnose='))?.slice('--hadron-diagnose='.length)
export const diagnosticRecorder=directory?createDiagnosticRecorder(directory):undefined
if(diagnosticRecorder){
 diagnosticRecorder.mark('bootstrap_started')
 process.on('uncaughtExceptionMonitor',()=>{try{diagnosticRecorder.fail('startup_failed')}catch{}})
 process.on('exit',code=>{try{diagnosticRecorder.fail('unexpected_exit',code)}catch{}})
 app.on('will-quit',()=>{try{diagnosticRecorder.fail('unexpected_exit',0)}catch{}})
 app.on('render-process-gone',()=>{try{diagnosticRecorder.fail('renderer_failed')}catch{}})
}
