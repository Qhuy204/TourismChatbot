import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card, Row, Col, Form, Input, Button, Result, Typography } from 'antd';
import { MailOutlined, CheckCircleOutlined, SendOutlined, PhoneOutlined, EnvironmentOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        setSubmitted(true);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <Title style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', marginBottom: 16, lineHeight: 1.1 }}>
                        We'd Love to <span className="text-gradient">Hear From You</span>
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 16, lineHeight: 1.7 }}>
                        Have a question about AIBOT? Want a demo or enterprise plan? Reach out and we'll get back to you within 24 hours.
                    </Paragraph>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <Row gutter={[48, 32]} align="top">
                        <Col xs={24} md={10}>
                            <Title level={3} style={{ marginBottom: 12 }}>
                                Contact Sales
                            </Title>
                            <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
                                Connect with us for custom solutions or product insights.
                            </Paragraph>

                            {[
                                'Request a demo',
                                'Find the right product for your business',
                                'Onboarding assistance',
                            ].map(item => (
                                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <CheckCircleOutlined style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                    <Text type="secondary" style={{ fontSize: 14 }}>{item}</Text>
                                </div>
                            ))}

                            <div style={{ marginTop: 40 }}>
                                <Title level={4} style={{ marginBottom: 16 }}>Support</Title>
                                <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 20 }}>
                                    Need help with technical issues or products?
                                </Paragraph>
                                {[
                                    { icon: <MailOutlined />, text: 'truongquochuy234@gmail.com' },
                                    { icon: <PhoneOutlined />, text: '+84 (0) 856 012 976' },
                                    { icon: <EnvironmentOutlined />, text: 'Hanoi, Vietnam' },
                                ].map(({ icon, text }) => (
                                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 9,
                                            background: 'rgba(29,109,224,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            color: 'var(--primary)', fontSize: 15,
                                        }}>
                                            {icon}
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{text}</Text>
                                    </div>
                                ))}
                            </div>
                        </Col>

                        <Col xs={24} md={14}>
                            <Card>
                                {submitted ? (
                                    <Result
                                        status="success"
                                        title="Message Sent!"
                                        subTitle="We'll get back to you within 24 hours."
                                    />
                                ) : (
                                    <>
                                        <Title level={4} style={{ marginBottom: 8 }}>
                                            Let's Begin The Discussion
                                        </Title>
                                        <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 32 }}>
                                            Fill out the form and our team will reach out to you promptly.
                                        </Paragraph>
                                        <Form layout="vertical" onFinish={handleSubmit}>
                                            <Row gutter={16}>
                                                <Col xs={24} sm={12}>
                                                    <Form.Item label="First Name" name="firstName" rules={[{ required: true, message: 'Required' }]}>
                                                        <Input placeholder="James" size="large" />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} sm={12}>
                                                    <Form.Item label="Last Name" name="lastName" rules={[{ required: true, message: 'Required' }]}>
                                                        <Input placeholder="Smith" size="large" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                            <Form.Item label="Email Address" name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                                                <Input placeholder="james@example.com" size="large" />
                                            </Form.Item>
                                            <Form.Item label="Message" name="message" rules={[{ required: true, message: 'Required' }]}>
                                                <TextArea rows={5} placeholder="Tell us about your needs..." size="large" />
                                            </Form.Item>
                                            <Button type="primary" htmlType="submit" icon={<SendOutlined />} block size="large" style={{ borderRadius: 10, fontWeight: 600 }}>
                                                Submit Request
                                            </Button>
                                        </Form>
                                    </>
                                )}
                            </Card>
                        </Col>
                    </Row>
                </div>
            </section>

            <Footer />
        </div>
    );
}
