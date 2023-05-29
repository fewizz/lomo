uniform sampler2D u_color;

layout(location = 0) out vec3 out_color;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;

	//out_color = smoothstep(vec3(0.0), vec3(1.0), out_color);
	out_color = vec3(1.0) - exp(-out_color * 2.0);

	//out_color = 1.0 - exp(-out_color / 1.0);
	/*float a = 2.51f;
	float b = 0.03f;
	float c = 2.43f;
	float d = 0.59f;
	float e = 0.14f;
	out_color = ((out_color*(a*out_color+b))/(out_color*(c*out_color+d)+e));*/

	out_color = pow(out_color, vec3(1.0 / 2.2));
}