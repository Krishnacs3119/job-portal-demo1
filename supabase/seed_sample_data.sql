-- ==============================================================================
-- PART 3: SAMPLE SEED DATA (3 COMPANIES, 10 JOBS)
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. In Supabase Dashboard -> Authentication -> Users, copy your recruiter user ID (UUID).
-- 2. Replace 'YOUR_RECRUITER_UUID_HERE' below with your actual user UUID.
-- 3. Paste and run this script in the Supabase SQL Editor.

DO $$
DECLARE
  recruiter_uuid uuid := 'YOUR_RECRUITER_UUID_HERE'::uuid; -- <-- REPLACE WITH YOUR USER UUID
  comp1_id uuid := gen_random_uuid();
  comp2_id uuid := gen_random_uuid();
  comp3_id uuid := gen_random_uuid();
BEGIN
  -- Check user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = recruiter_uuid) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users. Please replace YOUR_RECRUITER_UUID_HERE with an existing user UUID from Authentication -> Users.', recruiter_uuid;
  END IF;

  -- 1. Insert 3 Companies
  INSERT INTO public.companies (id, name, description, website, logo_url, location, verification_status, created_by)
  VALUES 
    (comp1_id, 'Novatech Solutions', 'Leading enterprise cloud computing and AI solutions company.', 'https://novatech.example.com', 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&h=100&fit=crop', 'Bengaluru, India', 'approved', recruiter_uuid),
    (comp2_id, 'FinEdge Systems', 'Next-generation fintech platforms modernizing digital payments.', 'https://finedge.example.com', 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=100&h=100&fit=crop', 'Mumbai, India', 'approved', recruiter_uuid),
    (comp3_id, 'HealthPulse Tech', 'Digital health and telemedicine products improving patient care.', 'https://healthpulse.example.com', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&h=100&fit=crop', 'Hyderabad, India', 'approved', recruiter_uuid);

  -- 2. Associate recruiter with these companies
  INSERT INTO public.company_members (company_id, user_id)
  VALUES 
    (comp1_id, recruiter_uuid),
    (comp2_id, recruiter_uuid),
    (comp3_id, recruiter_uuid)
  ON CONFLICT (company_id, user_id) DO NOTHING;

  -- 3. Insert 10 Jobs across the 3 companies
  INSERT INTO public.jobs (company_id, posted_by, title, description, requirements, location, job_type, salary_min, salary_max, experience_level, status)
  VALUES 
    (comp1_id, recruiter_uuid, 'Senior Full Stack Engineer', 
     'We are looking for a Senior Full Stack Engineer to lead architecture on our cloud microservices platform.',
     '• 5+ years experience with React, Node.js, and TypeScript\n• Strong grasp of PostgreSQL and database optimizations\n• Experience with AWS/GCP and Docker',
     'Bengaluru', 'full_time', 1800000, 2800000, '5+', 'open'),

    (comp1_id, recruiter_uuid, 'Frontend React Developer', 
     'Join our UI team building responsive, high-performance dashboards for enterprise clients.',
     '• 2+ years of hands-on React and Tailwind CSS experience\n• Proficiency with state management (Redux, Zustand, or TanStack)\n• Clean code practices and component testing',
     'Bengaluru', 'full_time', 800000, 1400000, '1-3', 'open'),

    (comp1_id, recruiter_uuid, 'DevOps & Cloud Engineer', 
     'Help us scale infrastructure reliability, CI/CD pipelines, and Kubernetes deployments.',
     '• 3+ years in DevOps / SRE roles\n• Terraform, Docker, Kubernetes experience\n• Experience with monitoring tools (Prometheus, Grafana)',
     'Remote', 'remote', 1400000, 2200000, '3-5', 'open'),

    (comp2_id, recruiter_uuid, 'Backend Go / Node.js Developer', 
     'Build ultra-low latency transaction processing services for our digital banking infrastructure.',
     '• Solid experience in Golang or Node.js\n• Experience designing distributed systems and event streams (Kafka/RabbitMQ)\n• High concurrency and SQL query tuning',
     'Mumbai', 'full_time', 1200000, 2000000, '3-5', 'open'),

    (comp2_id, recruiter_uuid, 'Junior QA Automation Engineer', 
     'Write automated integration and end-to-end tests for financial checkout flows.',
     '• 1-2 years experience with Playwright or Cypress\n• Basic understanding of REST API testing\n• Strong attention to detail and bug tracking',
     'Mumbai', 'full_time', 500000, 800000, '1-3', 'open'),

    (comp2_id, recruiter_uuid, 'Fintech Product Analyst Intern', 
     'Analyze user conversion funnels and collaborate with engineering to improve payment success rates.',
     '• Current student or recent graduate in CS, Math, or Business\n• Proficiency in SQL and Excel\n• Good analytical and communication skills',
     'Mumbai', 'internship', 25000, 40000, 'fresher', 'open'),

    (comp3_id, recruiter_uuid, 'Mobile App Developer (Flutter/React Native)', 
     'Develop cross-platform mobile apps enabling patients to schedule consultations and view health records.',
     '• 2+ years of production experience in Flutter or React Native\n• Integration with native device APIs and Bluetooth peripherals\n• App Store and Play Store release experience',
     'Hyderabad', 'full_time', 1000000, 1600000, '1-3', 'open'),

    (comp3_id, recruiter_uuid, 'Data Scientist (Health Informatics)', 
     'Work on predictive models and NLP pipelines extracting clinical insights from unstructured doctor notes.',
     '• Strong Python, PyTorch/TensorFlow, and Scikit-learn skills\n• Experience with healthcare datasets is a plus\n• Understanding of statistical validation and metrics',
     'Remote', 'remote', 1600000, 2500000, '3-5', 'open'),

    (comp3_id, recruiter_uuid, 'Graduate Software Engineer Trainee', 
     'Exciting opening for passionate fresh graduates to start their career in health tech development.',
     '• Degree in Computer Science or related fields\n• Sound fundamentals in data structures, algorithms, and OOP\n• Fast learner with curiosity for new web technologies',
     'Hyderabad', 'full_time', 450000, 650000, 'fresher', 'open'),

    (comp1_id, recruiter_uuid, 'Legacy Java Systems Consultant', 
     'Contract role to audit and migrate monolithic Java EE services to microservices.',
     '• 7+ years in Java enterprise systems\n• Migration to Spring Boot experience\n• 6-month extendable contract',
     'Bengaluru', 'contract', 1500000, 2000000, '5+', 'closed');

  RAISE NOTICE 'Sample data successfully seeded! 3 companies and 10 jobs created.';
END $$;
