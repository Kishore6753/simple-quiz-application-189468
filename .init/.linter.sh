#!/bin/bash
cd /home/kavia/workspace/code-generation/simple-quiz-application-189468/quiz_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

